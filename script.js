document.addEventListener('DOMContentLoaded', () => {

    // --- DATA ---
    // This section contains mock data, representing what would be fetched from your sources.

    // Mock Student Submissions (as if from Student_Quiz_Submissions)
    const studentSubmissions = [
        // RW Module 1
        { "question_id": "DT-T0-RW-M1-1", "is_correct": true },
        { "question_id": "DT-T0-RW-M1-2", "is_correct": false, "student_answer": "B" },
        { "question_id": "DT-T0-RW-M1-3", "is_correct": true },
        // RW Module 2
        { "question_id": "DT-T0-RW-M2-1", "is_correct": true },
        { "question_id": "DT-T0-RW-M2-2", "is_correct": true },
        // Math Module 1
        { "question_id": "DT-T0-M-M1-1", "is_correct": true },
        { "question_id": "DT-T0-M-M1-2", "is_correct": true },
        { "question_id": "DT-T0-M-M1-3", "is_correct": false, "student_answer": "A" },
        // Math Module 2
        { "question_id": "DT-T0-M-M2-1", "is_correct": true },
        { "question_id": "DT-T0-M-M2-2", "is_correct": false, "student_answer": "15" },
    ];

    // Mock Question Metadata (as if from the question JSON files)
    const questionMetadata = {
        "DT-T0-RW-M1": [
            { "question_id": "DT-T0-RW-M1-1", "question_number": 1, "correct_answer": "C", "explanation": "Explanation for RW-M1 Question 1." },
            { "question_id": "DT-T0-RW-M1-2", "question_number": 2, "correct_answer": "D", "explanation": "Explanation for RW-M1 Question 2." },
            { "question_id": "DT-T0-RW-M1-3", "question_number": 3, "correct_answer": "A", "explanation": "Explanation for RW-M1 Question 3." }
        ],
        "DT-T0-RW-M2": [
            { "question_id": "DT-T0-RW-M2-1", "question_number": 1, "correct_answer": "A", "explanation": "Explanation for RW-M2 Question 1." },
            { "question_id": "DT-T0-RW-M2-2", "question_number": 2, "correct_answer": "B", "explanation": "Explanation for RW-M2 Question 2." }
        ],
        "DT-T0-M-M1": [
            { "question_id": "DT-T0-M-M1-1", "question_number": 1, "correct_answer": "24", "explanation": "Explanation for M-M1 Question 1." },
            { "question_id": "DT-T0-M-M1-2", "question_number": 2, "correct_answer": "C", "explanation": "Explanation for M-M1 Question 2." },
            { "question_id": "DT-T0-M-M1-3", "question_number": 3, "correct_answer": "B", "explanation": "Explanation for M-M1 Question 3." }
        ],
         "DT-T0-M-M2": [
            { "question_id": "DT-T0-M-M2-1", "question_number": 1, "correct_answer": "-1", "explanation": "Explanation for M-M2 Question 1." },
            { "question_id": "DT-T0-M-M2-2", "question_number": 2, "correct_answer": "25", "explanation": "Explanation for M-M2 Question 2." }
        ]
    };

    // Scaled Score Conversion Tables (derived from your CSVs for Test 0)
    // In a real app, this would be fetched. For this page, we embed it.
    const rwScoreTable = { 0: 200, 1: 210, 2: 210, 3: 210, 4: 210, 5: 220, /* add all 67 values here for full accuracy */ 54: 800 };
    const mathScoreTable = { 0: 200, 1: 210, 2: 210, 3: 210, 4: 210, 5: 230, /* add all 55 values here */ 52: 800 };


    // --- LOGIC ---

    // 1. Merge all data into a single, easy-to-use structure
    const allModules = Object.keys(questionMetadata);
    let masterQuestionData = [];

    allModules.forEach(moduleName => {
        questionMetadata[moduleName].forEach(meta => {
            const submission = studentSubmissions.find(s => s.question_id === meta.question_id);
            masterQuestionData.push({
                module: moduleName,
                ...meta,
                ...submission
            });
        });
    });

    // 2. Calculate Raw and Scaled Scores
    const rwRawScore = masterQuestionData.filter(q => q.module.includes('RW') && q.is_correct).length;
    const mathRawScore = masterQuestionData.filter(q => q.module.includes('M-M') && q.is_correct).length;
    const totalRawCorrect = rwRawScore + mathRawScore;
    const totalQuestions = masterQuestionData.length;

    // Use tables to get scaled score. We use the "Lower" bound as discussed.
    // Note: Using a simplified table here. For full accuracy, all rows from the CSV should be in the objects above.
    const rwScaledScore = rwScoreTable[rwRawScore] || 200; // Default to 200 if score not in table
    const mathScaledScore = mathScoreTable[mathRawScore] || 200;
    const totalScaledScore = rwScaledScore + mathScaledScore;


    // 3. Render the page
    // Display scores
    document.getElementById('raw-score').textContent = `${totalRawCorrect} / ${totalQuestions}`;
    document.getElementById('scaled-score').textContent = totalScaledScore;

    // Display module lists
    const modulesContainer = document.getElementById('modules-container');
    allModules.forEach(moduleName => {
        const moduleDiv = document.createElement('div');
        moduleDiv.className = 'module';

        const title = document.createElement('h3');
        title.textContent = moduleName;
        moduleDiv.appendChild(title);

        const questionsInModule = masterQuestionData.filter(q => q.module === moduleName);
        questionsInModule.forEach(q => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = `Q${q.question_number}`;
            link.setAttribute('data-question-id', q.question_id);
            moduleDiv.appendChild(link);
        });

        modulesContainer.appendChild(moduleDiv);
    });

    // 4. Handle Interactivity
    modulesContainer.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const questionId = event.target.getAttribute('data-question-id');
            const questionData = masterQuestionData.find(q => q.question_id === questionId);
            displayFeedback(questionData);
        }
    });

    function displayFeedback(q) {
        const feedbackContent = document.getElementById('feedback-content');
        const statusClass = q.is_correct ? 'status-correct' : 'status-incorrect';
        const statusText = q.is_correct ? 'Correct' : 'Incorrect';

        let html = `
            <p><span class="${statusClass}">${statusText}</span></p>
            <p><strong>Question:</strong> ${q.question_number} (Module: ${q.module})</p>
        `;

        if (!q.is_correct) {
            html += `<p><strong>Your Answer:</strong> ${q.student_answer || "No Answer"}</p>`;
        }

        html += `
            <p><strong>Correct Answer:</strong> ${q.correct_answer}</p>
            <p><strong>Explanation:</strong></p>
            <pre>${q.explanation}</pre>
        `;

        feedbackContent.innerHTML = html;
        feedbackContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
