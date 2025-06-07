// ... (rest of your script.js code remains the same above this point) ...

/**
 * Transforms raw CSV data into the structured currentStudentData object.
 * This is the core data processing logic.
 * @param {Array<Object>} aggregatedScoresData - Data from DashboardFeed_AggregatedScores.
 * @param {Array<Object>} questionDetailsData - Data from DashboardFeed_QuestionDetails.
 * @returns {Object} The transformed currentStudentData object.
 */
function transformRawData(aggregatedScoresData, questionDetailsData) {
    console.log("Starting data transformation...");

    // Determine the student to display. For now, let's take the first unique student found.
    // In a real app, this would be a user selection or login-based.
    const uniqueStudentGmailIDs = [...new Set(aggregatedScoresData.map(row => row.StudentGmailID))];
    const targetStudentGmailID = uniqueStudentGmailIDs[0] || "default@example.com"; // Fallback
    console.log("Targeting data for student:", targetStudentGmailID);

    // Filter data for the target student
    const studentAggregatedScores = aggregatedScoresData.filter(row => row.StudentGmailID === targetStudentGmailID);
    const studentQuestionDetails = questionDetailsData.filter(row => row.StudentGmailID === targetStudentGmailID);

    let transformedData = {
        studentName: studentAggregatedScores.length > 0 ? studentAggregatedScores[0]['StudentFullName'] : "Unknown Student",
        targetScore: studentAggregatedScores.length > 0 ? studentAggregatedScores[0]['StudentTargetScore'] : 1400,
        latestScores: { total: 0, rw: 0, math: 0, avgEocKhan: 0 }, // Will be calculated
        timeSpent: { studentAvg: 0, studentUnit: "min / day", classAvg: 0, classUnit: "min / day"}, // Will be calculated/derived
        scoreTrend: { labels: [], studentScores: [], classAvgScores: [] }, // Will be populated from CB Tests
        overallSkillPerformance: { labels: [], studentAccuracy: [], classAvgAccuracy: [] }, // Will be populated from question details

        cbPracticeTests: [],
        eocQuizzes: {
            reading: [],
            writing: [],
            math: []
        },
        khanAcademy: {
            reading: [],
            writing: [],
            math: []
        },
        skills: {
            reading: [],
            writing: [],
            math: []
        },
        chapters: currentStudentData.chapters // Retain static chapters mapping
    };

    // --- Process CB Practice Tests from Aggregated Scores ---
    const cbTests = studentAggregatedScores.filter(row => row.AssessmentSource === 'Canvas CB Test' && row.AssessmentName.startsWith('CB-T') || row.AssessmentName.startsWith('DG-T0'));
    // Sort CB Tests by attempt date if available, or by name
    cbTests.sort((a, b) => {
        if (a.AttemptDate && b.AttemptDate) return new Date(a.AttemptDate) - new Date(b.AttemptDate);
        return a.AssessmentName.localeCompare(b.AssessmentName);
    });

    // Keep track of which official tests have been attempted
    const attemptedCBTNames = new Set(cbTests.map(t => t.AssessmentName));
    const allOfficialCBTNames = [ // Ensure all 8 CB Tests are represented, even if not attempted
        "DG-T0", "CB-T1", "CB-T2", "CB-T3", "CB-T4", "CB-T5", "CB-T6", "CB-T7", "CB-T8", "CB-T9", "CB-T10"
        // Add more as per your full list of official tests if different
    ];

    allOfficialCBTNames.forEach(testName => {
        const foundTest = cbTests.find(t => t.AssessmentName === testName);
        if (foundTest) {
            // Find all questions related to this test from questionDetailsData
            const testQuestions = studentQuestionDetails.filter(q =>
                q.AssessmentName === foundTest.AssessmentName
            ).map(qRow => ({
                id: `${qRow.AssessmentName}-Q${qRow.QuestionSequenceInQuiz}`,
                subject: qRow.SAT_Skill_Tag && (qRow.SAT_Skill_Tag.includes("Math") ? "math" : qRow.SAT_Skill_Tag.includes("Reading") ? "reading" : qRow.SAT_Skill_Tag.includes("Writing") ? "writing" : "unknown"), // Derive subject
                skill: qRow.SAT_Skill_Tag,
                difficulty: qRow.Difficulty,
                yourAnswer: qRow.StudentAnswer,
                correctAnswer: qRow.IsCorrect === true ? qRow.StudentAnswer : "N/A (check raw data for actual correct answer)", // Placeholder, need actual correct answer
                isCorrect: qRow.IsCorrect,
                explanation: "Explanation will go here if available from another source", // Placeholder for explanations
                yourTime: qRow.TimeSpentOnQuestion_Seconds,
                classAvgTime: qRow.ClassAveragePoints_Question, // Assuming this is actually class average time, rename later
                classPerformance: {
                    correct: qRow.ClassAveragePoints_Question !== null ? Math.round((qRow.ClassAveragePoints_Question / qRow.PointsPossible_Question) * 100) : 0, // Placeholder calculation, need actual class performance %
                    incorrect: 0, // Placeholder
                    unanswered: 0 // Placeholder
                },
                source: foundTest.AssessmentSource,
                text: qRow.QuestionText_fromMetadata
            }));

            // Calculate score for the test based on individual question correctness if needed
            // For now, use aggregated scores
            transformedData.cbPracticeTests.push({
                name: foundTest.AssessmentName,
                date: foundTest.AttemptDate,
                rw: foundTest.ScaledScore_RW || "-",
                math: foundTest.ScaledScore_Math || "-",
                total: foundTest.ScaledScore_Total || "-",
                questions: testQuestions
            });
        } else {
            // Add as "Not Attempted"
            transformedData.cbPracticeTests.push({
                name: testName,
                date: "Not Attempted",
                rw: "-",
                math: "-",
                total: "-",
                questions: []
            });
        }
    });

    // --- Populate Score Trend (from CB Tests) ---
    transformedData.scoreTrend.labels = transformedData.cbPracticeTests
        .filter(t => t.date !== "Not Attempted" && t.total !== "-")
        .map(t => t.name);
    transformedData.scoreTrend.studentScores = transformedData.cbPracticeTests
        .filter(t => t.date !== "Not Attempted" && t.total !== "-")
        .map(t => t.total);
    transformedData.scoreTrend.classAvgScores = transformedData.cbPracticeTests
        .filter(t => t.date !== "Not Attempted" && t.total !== "-")
        .map(t => {
            const correspondingAggregatedRow = studentAggregatedScores.find(s => s.AssessmentName === t.name);
            return correspondingAggregatedRow ? correspondingAggregatedRow.ClassAverageScore_Normalized : null; // Use normalized class average
        });


    // --- Calculate Overall Scores and Latest Scores ---
    const latestTest = transformedData.cbPracticeTests.filter(t => t.date !== "Not Attempted" && t.total !== "-").sort((a,b) => new Date(b.date) - new Date(a.date))[0];
    if (latestTest) {
        transformedData.latestScores.total = latestTest.total;
        transformedData.latestScores.rw = latestTest.rw;
        transformedData.latestScores.math = latestTest.math;
    }

    // --- Process EOC Quizzes and Khan Academy (Initial Structure) ---
    // Group question details by AssessmentSource and AssessmentName
    const quizzesByAssessment = {};
    studentQuestionDetails.forEach(qRow => {
        const assessmentName = qRow.AssessmentName;
        const assessmentSource = qRow.AssessmentSource;
        if (!quizzesByAssessment[assessmentSource]) {
            quizzesByAssessment[assessmentSource] = {};
        }
        if (!quizzesByAssessment[assessmentSource][assessmentName]) {
            quizzesByAssessment[assessmentSource][assessmentName] = [];
        }
        quizzesByAssessment[assessmentSource][assessmentName].push(qRow);
    });

    for (const source in quizzesByAssessment) {
        for (const name in quizzesByAssessment[source]) {
            const questions = quizzesByAssessment[source][name].map(qRow => ({
                id: `${name}-Q${qRow.QuestionSequenceInQuiz}`,
                subject: qRow.SAT_Skill_Tag && (qRow.SAT_Skill_Tag.includes("Math") ? "math" : qRow.SAT_Skill_Tag.includes("Reading") ? "reading" : qRow.SAT_Skill_Tag.includes("Writing") ? "writing" : "unknown"), // Derive subject
                skill: qRow.SAT_Skill_Tag,
                difficulty: qRow.Difficulty,
                yourAnswer: qRow.StudentAnswer,
                correctAnswer: qRow.IsCorrect === true ? qRow.StudentAnswer : "N/A", // Need actual correct answer if not provided
                isCorrect: qRow.IsCorrect,
                explanation: "Explanation will go here if available",
                yourTime: qRow.TimeSpentOnQuestion_Seconds,
                classAvgTime: qRow.ClassAveragePoints_Question, // Assuming this is class average time, rename later
                classPerformance: {
                    correct: qRow.ClassAveragePoints_Question !== null ? Math.round((qRow.ClassAveragePoints_Question / qRow.PointsPossible_Question) * 100) : 0,
                    incorrect: 0,
                    unanswered: 0
                },
                source: source,
                text: qRow.QuestionText_fromMetadata
            }));

            // Calculate quiz score and find attempt date if possible from aggregated scores
            const matchingAggregatedScore = studentAggregatedScores.find(s => s.AssessmentName === name);
            const latestScorePercentage = matchingAggregatedScore ? matchingAggregatedScore.Score_Percentage : null;
            const latestScoreRaw = matchingAggregatedScore ? `${matchingAggregatedScore.Score_Raw_Combined}/${matchingAggregatedScore.PointsPossible_Combined}` : null;
            const attemptDate = matchingAggregatedScore ? matchingAggregatedScore.AttemptDate : "N/A";

            const quizEntry = {
                name: name,
                date: attemptDate,
                latestScore: latestScorePercentage !== null ? `${latestScorePercentage}% (${latestScoreRaw})` : "N/A",
                questions: questions
            };

            if (source === 'Canvas EOC Practice') {
                const subjectCategory = quizEntry.name.toLowerCase().includes('r-eoc') ? 'reading' :
                                        quizEntry.name.toLowerCase().includes('w-eoc') ? 'writing' :
                                        quizEntry.name.toLowerCase().includes('m-eoc') ? 'math' : 'unknown';
                if (transformedData.eocQuizzes[subjectCategory]) {
                    transformedData.eocQuizzes[subjectCategory].push(quizEntry);
                }
            } else if (source === 'Khan Academy Practice') {
                // For Khan Academy, we might need to categorize by subject.
                // Assuming "Khan: Reading", "Khan: Writing", "Khan: Math" in AssessmentName or SkillTag
                const khanSubject = quizEntry.name.toLowerCase().includes('reading') ? 'reading' :
                                    quizEntry.name.toLowerCase().includes('writing') || quizEntry.name.toLowerCase().includes('grammar') ? 'writing' :
                                    quizEntry.name.toLowerCase().includes('math') || quizEntry.name.toLowerCase().includes('algebra') || quizEntry.name.toLowerCase().includes('geometry') ? 'math' : 'unknown';
                if (transformedData.khanAcademy[khanSubject]) {
                    transformedData.khanAcademy[khanSubject].push(quizEntry);
                }
            }
        }
    }


    // --- Calculate Skill Performance (from all questions) ---
    const allStudentQuestions = studentQuestionDetails; // Use all raw questions for skill aggregation
    const skillScores = {}; // skillName: { correctCount, totalCount }

    allStudentQuestions.forEach(q => {
        const skill = q.SAT_Skill_Tag;
        if (!skill) return;

        if (!skillScores[skill]) {
            skillScores[skill] = { correctCount: 0, totalCount: 0, classAvg: 0, classSumPoints: 0, classTotalPossible: 0 };
        }
        skillScores[skill].totalCount++;
        if (q.IsCorrect === true) {
            skillScores[skill].correctCount++;
        }
        // For class average: sum up class average points and total possible points
        if (q.ClassAveragePoints_Question !== null && q.PointsPossible_Question !== null) {
            skillScores[skill].classSumPoints += q.ClassAveragePoints_Question;
            skillScores[skill].classTotalPossible += q.PointsPossible_Question;
        }
    });

    const subjects = ['reading', 'writing', 'math'];
    subjects.forEach(subject => {
        transformedData.skills[subject] = [];
    });

    for (const skillName in skillScores) {
        const scoreData = skillScores[skillName];
        const studentScore = scoreData.totalCount > 0 ? Math.round((scoreData.correctCount / scoreData.totalCount) * 100) : 0;
        const classAvgScore = scoreData.classTotalPossible > 0 ? Math.round((scoreData.classSumPoints / scoreData.classTotalPossible) * 100) : 0;

        let subjectCategory = 'unknown';
        if (skillName.includes('Reading')) subjectCategory = 'reading';
        else if (skillName.includes('Writing') || skillName.includes('Grammar') || skillName.includes('Punctuation')) subjectCategory = 'writing';
        else if (skillName.includes('Math') || skillName.includes('Algebra') || skillName.includes('Geometry')) subjectCategory = 'math';

        if (transformedData.skills[subjectCategory]) {
            transformedData.skills[subjectCategory].push({
                name: skillName,
                score: studentScore,
                classAvg: classAvgScore,
                attempted: scoreData.totalCount > 0
            });
        }
    }

    // --- Calculate OverallSkillPerformance (for overview chart) ---
    subjects.forEach(subject => {
        const subjectSkills = transformedData.skills[subject];
        if (subjectSkills.length > 0) {
            const totalStudentAccuracy = subjectSkills.reduce((sum, s) => sum + s.score, 0);
            const totalClassAccuracy = subjectSkills.reduce((sum, s) => sum + s.classAvg, 0);
            transformedData.overallSkillPerformance.labels.push(subject.charAt(0).toUpperCase() + subject.slice(1));
            transformedData.overallSkillPerformance.studentAccuracy.push(Math.round(totalStudentAccuracy / subjectSkills.length));
            transformedData.overallSkillPerformance.classAvgAccuracy.push(Math.round(totalClassAccuracy / subjectSkills.length));
        }
    });
    
    // --- Calculate Time Spent (Placeholder - needs specific data for this) ---
    // The current CSVs have TimeSpent_Seconds for assessments and TimeSpentOnQuestion_Seconds for questions.
    // For overall time spent, you'd need a separate aggregation. For now, using placeholders.
    transformedData.timeSpent.studentAvg = Math.round(studentAggregatedScores.reduce((sum, row) => sum + (row.TimeSpent_Seconds || 0), 0) / (studentAggregatedScores.length || 1) / 60); // minutes per assessment
    transformedData.timeSpent.classAvg = Math.round(aggregatedScoresData.reduce((sum, row) => sum + (row.ClassAverageTime_Seconds || 0), 0) / (aggregatedScoresData.length || 1) / 60); // minutes per assessment
    transformedData.timeSpent.studentUnit = "min / assessment";
    transformedData.timeSpent.classUnit = "min / assessment";

    // --- Calculate Avg EOC/Khan Score ---
    const allEocKhanScores = Object.values(transformedData.eocQuizzes).flat().map(q => {
        const percentageMatch = q.latestScore.match(/(\d+)%/);
        return percentageMatch ? parseInt(percentageMatch[1]) : 0;
    }).filter(score => score > 0);

    const allKhanScores = Object.values(transformedData.khanAcademy).flat().map(q => {
        const percentageMatch = q.latestScore.match(/(\d+)%/);
        return percentageMatch ? parseInt(percentageMatch[1]) : 0;
    }).filter(score => score > 0);

    const combinedEocKhanScores = [...allEocKhanScores, ...allKhanScores];
    if (combinedEocKhanScores.length > 0) {
        transformedData.latestScores.avgEocKhan = Math.round(combinedEocKhanScores.reduce((sum, score) => sum + score, 0) / combinedEocKhanScores.length);
    }


    console.log("Transformed Data:", transformedData);
    return transformedData;
}

// ... (rest of your script.js code remains the same below this point) ...
