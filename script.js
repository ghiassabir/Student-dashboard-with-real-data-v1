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
        "English Module 1": { type: 'RW', count: 27, dataKey: 'eng1' },
        "English Module 2": { type: 'RW', count: 27, dataKey: 'eng2' },
        "Math Module 1": { type: 'Math', count: 22, dataKey: 'math1' },
        "Math Module 2": { type: 'Math', count: 22, dataKey: 'math2' }
    };

    // --- HELPER FUNCTIONS ---

    // Simple function to parse CSV text into an array of objects
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

    // NEW: Function to process the large scoring array into an efficient lookup map
    function processScoringData(scoringArray) {
        const lookupTables = { RW: {}, Math: {} };
        const rawScoreKey = "Raw Score (# of Correct Answers)";
        
        // We'll use Test 0 for this diagnostic, as an example
        const rwScaledScoreKey = "Test 0 RW Lower";
        const mathScaledScoreKey = "Test 0 Math Lower";

        scoringArray.forEach(row => {
            const rawScore = row[rawScoreKey];
            
            // Check if this row is for Reading/Writing
            if (row[rwScaledScoreKey] !== undefined) {
                lookupTables.RW[rawScore] = row[rwScaledScoreKey];
            }
            // Check if this row is for Math
            else if (row[mathScaledScoreKey] !== undefined) {
                lookupTables.Math[rawScore] = row[mathScaledScoreKey];
            }
        });
        return lookupTables;
    }
    
    // UPDATED: This function now uses the processed lookup map
    const getScaledScore = (rawScore, subject, lookupMap) => {
        const table = subject === 'RW' ? lookupMap.RW : lookupMap.Math;
        return table[rawScore] || 200; // Return score from table or 200 if not found
    };


    // --- MAIN EXECUTION ---

    // 1. Get Student Email
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

    // Show a loading message
    const feedbackContent = document.getElementById('feedback-content');
    feedbackContent.innerHTML = '<p>Loading student data...</p>';

    try {
        // 2. Fetch all data files from GitHub concurrently
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
        
        // NEW STEP: Process the scoring data into a lookup map
        const scoringTable = processScoringData(scoringArray);
        
        // 3. Parse and Filter Student Submissions
        const allSubmissions = parseCSV(submissionsText);
        const studentSubmissions = allSubmissions.filter(row => row.student_gmail_id === studentEmail);

        if (studentSubmissions.length === 0) {
            alert(`No submission data found for email: ${studentEmail}`);
            return;
        }
        
        // 4. Merge data, Calculate scores, and Render page
        let masterQuestionData = [];
        Object.keys(questionMetadata).forEach(moduleName => {
            questionMetadata[moduleName].forEach(meta => {
                const submission = studentSubmissions.find(s => s.question_id === meta.question_id) || {};
                masterQuestionData.push({ 
                    module: moduleName, 
                    is_correct: submission.is_correct === 'TRUE', // CSV values are strings
                    student_answer: submission.student_answer,
                    ...meta 
                });
            });
        });

        const rwRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'RW' && q.is_correct).length;
        const mathRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'Math' && q.is_correct).length;
        const totalRwQuestions = modulesConfig["English Module 1"].count + modulesConfig["English Module 2"].count;
        const totalMathQuestions = modulesConfig["Math Module 1"].count + modulesConfig["Math Module 2"].count;
        
        // UPDATED CALL: Pass the new processed lookup map
        const rwScaledScore = getScaledScore(rwRawScore, 'RW', scoringTable);
        const mathScaledScore = getScaledScore(mathRawScore, 'Math', scoringTable);
        const totalScaledScore = rwScaledScore + mathScaledScore;

        document.getElementById('english-score').textContent = `${rwRawScore}/${totalRwQuestions} Raw | ${rwScaledScore} Scaled`;
        document.getElementById('math-score').textContent = `${mathRawScore}/${totalMathQuestions} Raw | ${mathScaledScore} Scaled`;
        document.getElementById('total-score').textContent = `${rwRawScore + mathRawScore}/${totalRwQuestions + totalMathQuestions} Raw | ${totalScaledScore} Scaled`;

        const modulesContainer = document.getElementById('modules-container');
        modulesContainer.innerHTML = ''; // Clear previous content
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
                list.appendChild(link);
            });

            moduleWrapper.appendChild(list);
            modulesContainer.appendChild(moduleWrapper);
        });
        
        feedbackContent.innerHTML = '<p>Please click on a question number above to see the details.</p>';


        // 5. Handle Interactivity
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
        const statusClass = q.is_correct ? 'status-correct' : 'status-incorrect';
        const statusText = q.is_correct ? 'Correct' : 'Incorrect';

        let html = `
            <p><span class="${statusClass}">${statusText}</span></p>
            <p><strong>Question:</strong> ${q.question_number} (Module: ${q.module})</p>
            <div class="question-text">${q.question_text || 'Question text not available.'}</div>
            <p><strong>Your Choice:</strong> ${q.student_answer || "No Answer"}</p>
            <p><strong>Correct Choice:</strong> ${q.correct_answer}</p>
            <p><strong>Explanation:</strong></p>
            <pre>${q.explanation || 'Explanation not available.'}</pre>
        `;

        feedbackContent.innerHTML = html;
        document.getElementById('feedback-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
