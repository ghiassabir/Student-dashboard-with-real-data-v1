document.addEventListener('DOMContentLoaded', async () => {

    // --- CONFIGURATION ---
    // ACTION REQUIRED: Replace these placeholder URLs with the actual "Raw" URLs from your GitHub repository.
    const fileUrls = {
        submissions: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSxW6lYLIfH1r9954znKNbcE90y5qit38yhhyhZnTv_pMCM46H6DdFzQ5ekkJbqtAwfwVBbNegOVzmU/pub?gid=0&single=true&output=csv',
        scoring: 'https://raw.githubusercontent.com/ghiassabir/Student-dashboard-with-real-data-v1/refs/heads/Diagnostic-Dashboard/scoring/Raw_to_Scaled_Conversion_table_RW.json',
        eng1: 'https://raw.githubusercontent.com/ghiassabir/Student-dashboard-with-real-data-v1/refs/heads/Diagnostic-Dashboard/metadata/DT-T0-RW-M1.json',
        eng2: 'https://raw.githubusercontent.com/ghiassabir/Student-dashboard-with-real-data-v1/refs/heads/Diagnostic-Dashboard/metadata/DT-T0-RW-M2.json',
        math1: 'https://raw.githubusercontent.com/ghiassabir/Student-dashboard-with-real-data-v1/refs/heads/Diagnostic-Dashboard/metadata/DT-T0-MT-M1.json',
        math2: 'https://raw.githubusercontent.com/ghiassabir/Student-dashboard-with-real-data-v1/refs/heads/Diagnostic-Dashboard/metadata/DT-T0-MT-M2.json',
    };

    const modulesConfig = {
        "English Module 1": { type: 'RW' },
        "English Module 2": { type: 'RW' },
        "Math Module 1": { type: 'Math' },
        "Math Module 2": { type: 'Math' }
    };

    // --- HELPER FUNCTIONS ---

    // --- ADD THIS NEW FUNCTION IN ITS PLACE ---
function parseCSV(text) {
    let lines = text.split('\n');
    // The first line contains the headers.
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    // Loop through the data lines (starting from the second line).
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue; // Skip empty lines.

        const obj = {};
        let values = [];
        let current_value = '';
        let in_quotes = false;

        // This advanced loop correctly handles commas inside quotes.
        for (const char of lines[i]) {
            if (char === '"' && in_quotes) {
                in_quotes = false;
            } else if (char === '"' && !in_quotes) {
                in_quotes = true;
            } else if (char === ',' && !in_quotes) {
                values.push(current_value.trim());
                current_value = '';
            } else {
                current_value += char;
            }
        }
        values.push(current_value.trim());

        // Assign values to their corresponding headers.
        for (let j = 0; j < headers.length; j++) {
            let value = values[j] || '';
            // Remove leading/trailing quotes if they exist from the parsed value.
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            obj[headers[j]] = value;
        }
        result.push(obj);
    }
    return result;
}
    
    /*
    function parseCSV(text) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const obj = {};
            const currentline = lines[i].split(',');
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j].trim();
            }
            result.push(obj);
        }
        return result;
    }
    */
    function processScoringData(scoringArray) {
        const lookupTables = { RW: {}, Math: {} };
        const rawScoreKey = "Raw Score (# of Correct Answers)";
        const rwScaledScoreKey = "Test 0 RW Lower";
        const mathScaledScoreKey = "Test 0 Math Lower";
        scoringArray.forEach(row => {
            const rawScore = row[rawScoreKey];
            if (row[rwScaledScoreKey] !== undefined) {
                lookupTables.RW[rawScore] = row[rwScaledScoreKey];
            } else if (row[mathScaledScoreKey] !== undefined) {
                lookupTables.Math[rawScore] = row[mathScaledScoreKey];
            }
        });
        return lookupTables;
    }
    
    const getScaledScore = (rawScore, subject, lookupMap) => {
        const table = subject === 'RW' ? lookupMap.RW : lookupMap.Math;
        return table[rawScore] || 200;
    };

    // --- MAIN EXECUTION ---
    let studentEmail = localStorage.getItem('studentEmail');
    if (!studentEmail) {
        studentEmail = prompt("Please enter your student email address:");
        if (studentEmail) {
            localStorage.setItem('studentEmail', studentEmail);
        } else {
            alert("Email is required to view the report.");
            return;
        }
    }

    const feedbackContent = document.getElementById('feedback-content');
    feedbackContent.innerHTML = '<p>Loading student data...</p>';

    try {
        const [
            submissionsRes, scoringRes, eng1Res, eng2Res, math1Res, math2Res
        ] = await Promise.all([
            fetch(fileUrls.submissions), fetch(fileUrls.scoring), fetch(fileUrls.eng1),
            fetch(fileUrls.eng2), fetch(fileUrls.math1), fetch(fileUrls.math2)
        ]);

        const submissionsText = await submissionsRes.text();
        const scoringArray = await scoringRes.json();
        const questionMetadata = {
            "English Module 1": await eng1Res.json(),
            "English Module 2": await eng2Res.json(),
            "Math Module 1": await math1Res.json(),
            "Math Module 2": await math2Res.json()
        };
        
        const scoringTable = processScoringData(scoringArray);
        const allSubmissions = parseCSV(submissionsText);
        const studentSubmissions = allSubmissions.filter(row => row.student_gmail_id === studentEmail);

        if (studentSubmissions.length === 0) {
            alert(`No submission data found for email: ${studentEmail}`);
            return;
        }
        
        let masterQuestionData = [];
        Object.keys(questionMetadata).forEach(moduleName => {
            (questionMetadata[moduleName] || []).forEach(meta => {
                const submission = studentSubmissions.find(s => s.question_id === meta.question_id);
                masterQuestionData.push({ 
                    module: moduleName, 
                    is_correct: submission ? submission.is_correct === 'TRUE' : undefined,
                    student_answer: submission ? submission.student_answer : undefined,
                    ...meta 
                });
            });
        });

        const rwRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'RW' && q.is_correct).length;
        const mathRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'Math' && q.is_correct).length;
        const totalRwQuestions = (questionMetadata["English Module 1"] || []).length + (questionMetadata["English Module 2"] || []).length;
        const totalMathQuestions = (questionMetadata["Math Module 1"] || []).length + (questionMetadata["Math Module 2"] || []).length;
        
        const rwScaledScore = getScaledScore(rwRawScore, 'RW', scoringTable);
        const mathScaledScore = getScaledScore(mathRawScore, 'Math', scoringTable);
        const totalScaledScore = rwScaledScore + mathScaledScore;

        document.getElementById('english-score').textContent = `${rwRawScore}/${totalRwQuestions} Raw | ${rwScaledScore} Scaled`;
        document.getElementById('math-score').textContent = `${mathRawScore}/${totalMathQuestions} Raw | ${mathScaledScore} Scaled`;
        document.getElementById('total-score').textContent = `${rwRawScore + mathRawScore}/${totalRwQuestions + totalMathQuestions} Raw | ${totalScaledScore} Scaled`;

        const modulesContainer = document.getElementById('modules-container');
        modulesContainer.innerHTML = '';
        Object.keys(modulesConfig).forEach(moduleName => {
            const moduleWrapper = document.createElement('div');
            moduleWrapper.className = 'module';
            
            const questionsInModule = masterQuestionData.filter(q => q.module === moduleName);
            const moduleRawCorrect = questionsInModule.filter(q => q.is_correct).length;
            
            const header = document.createElement('div');
            header.className = 'module-header';
            header.textContent = `${moduleName} (${moduleRawCorrect}/${questionsInModule.length})`;
            moduleWrapper.appendChild(header);

            const list = document.createElement('div');
            list.className = 'question-list';
            
            questionsInModule.forEach(q => {
                const link = document.createElement('a');
                link.href = '#feedback-container';
                link.textContent = `Q${q.question_number}`;
                link.setAttribute('data-question-id', q.question_id);

                // --- LOGIC ADDED FOR COLOR CODING ---
                if (q.student_answer === undefined) {
                    link.classList.add('q-unanswered');
                } else if (q.is_correct) {
                    link.classList.add('q-correct');
                } else {
                    link.classList.add('q-incorrect');
                }
                // --- END OF ADDED LOGIC ---

                list.appendChild(link);
            });

            moduleWrapper.appendChild(list);
            modulesContainer.appendChild(moduleWrapper);
        });
        
        feedbackContent.innerHTML = '<p>Please click on a question number above to see the details.</p>';

        modulesContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'A') {
                event.preventDefault();
                const questionId = event.target.getAttribute('data-question-id');
                const questionData = masterQuestionData.find(q => q.question_id === questionId);
                displayFeedback(questionData);
            }
        });

    } catch (error) {
        console.error("Failed to load or process diagnostic data:", error);
        feedbackContent.innerHTML = `<p style="color:red;">Error: Could not load data. Please check the console for details and ensure all GitHub URLs are correct.</p>`;
    }

    function displayFeedback(q) {
        // This function remains the same as the previous version
        const feedbackContent = document.getElementById('feedback-content');
        const statusClass = q.is_correct ? 'status-correct' : (q.student_answer === undefined ? '' : 'status-incorrect');
        const statusText = q.is_correct ? 'Correct' : (q.student_answer === undefined ? 'Unanswered' : 'Incorrect');

        const getChoiceLetter = (answerValue) => {
            if (!answerValue) return "N/A";
            if (q.option_a === answerValue) return 'A';
            if (q.option_b === answerValue) return 'B';
            if (q.option_c === answerValue) return 'C';
            if (q.option_d === answerValue) return 'D';
            if (q.option_e === answerValue) return 'E';
            return answerValue;
        };
        
        const correctChoiceLetter = getChoiceLetter(q.correct_answer);

        let questionDisplay = '';
        if (q.passage_content) {
            questionDisplay += `<p><em>${q.passage_content.replace(/______/g, '______')}</em></p>`;
        }
        questionDisplay += `<p><b>${q.question_stem || ''}</b></p>`;

        let html = `
            <p><span class="${statusClass}">${statusText}</span></p>
            <p><strong>Question:</strong> ${q.question_number} (Module: ${q.module})</p>
            <div class="question-text">${questionDisplay}</div>
            <p><strong>Your Choice:</strong> ${q.student_answer || "Not Answered"}</p>
            <p><strong>Correct Choice:</strong> ${correctChoiceLetter} (${q.correct_answer})</p>
            <p><strong>Explanation:</strong></p>
            <pre>${q.explanation_ai_enhanced || q.explanation_original || 'Explanation not available.'}</pre>
        `;

        feedbackContent.innerHTML = html;
        document.getElementById('feedback-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
