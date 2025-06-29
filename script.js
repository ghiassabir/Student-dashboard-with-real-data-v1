document.addEventListener('DOMContentLoaded', () => {

    // --- DATA GENERATION & MOCKING ---

    const modulesConfig = {
        "English Module 1": { type: 'RW', count: 27 },
        "English Module 2": { type: 'RW', count: 27 },
        "Math Module 1": { type: 'Math', count: 22 },
        "Math Module 2": { type: 'Math', count: 22 }
    };

    let studentSubmissions = [];
    let questionMetadata = {};
    const choices = ['A', 'B', 'C', 'D'];

    // Programmatically generate more realistic mock data
    for (const moduleName in modulesConfig) {
        questionMetadata[moduleName] = [];
        const config = modulesConfig[moduleName];
        for (let i = 1; i <= config.count; i++) {
            const questionId = `${moduleName.replace(/ /g, '-')}-Q${i}`;
            const isCorrect = Math.random() > 0.3; // Simulate ~70% accuracy
            const correctAnswer = choices[Math.floor(Math.random() * choices.length)];
            let studentAnswer;

            if (isCorrect) {
                studentAnswer = correctAnswer;
            } else {
                // Pick a random wrong answer
                const wrongChoices = choices.filter(c => c !== correctAnswer);
                studentAnswer = wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
            }
            
            // Create submission data
            studentSubmissions.push({
                question_id: questionId,
                is_correct: isCorrect,
                student_answer: studentAnswer
            });

            // Create metadata
            questionMetadata[moduleName].push({
                question_id: questionId,
                question_number: i,
                question_text: `This is the full text for Question ${i}. It might be a long passage or a complex word problem to test the layout and formatting.`,
                options: { A: 'Option A text', B: 'Option B text', C: 'Option C text', D: 'Option D text' },
                correct_answer: correctAnswer,
                explanation: `This is the detailed explanation for ${moduleName}, Question ${i}. The correct answer is ${correctAnswer} because of specific reasons outlined here.`
            });
        }
    }

    // --- SCALED SCORE CONVERSION LOGIC ---
    const getScaledScore = (rawScore, subject) => {
        const minScore = 200;
        const maxScore = 800;
        if (subject === 'RW') {
            const maxRaw = modulesConfig["English Module 1"].count + modulesConfig["English Module 2"].count; // 54
            if (rawScore <= 0) return 200;
            if (rawScore >= maxRaw) return 800;
            return Math.round(200 + (rawScore / maxRaw) * 600); // Simplified linear scaling
        }
        if (subject === 'Math') {
            const maxRaw = modulesConfig["Math Module 1"].count + modulesConfig["Math Module 2"].count; // 44
             if (rawScore <= 0) return 200;
            if (rawScore >= maxRaw) return 800;
            return Math.round(200 + (rawScore / maxRaw) * 600);
        }
        return 0;
    };


    // --- MAIN LOGIC ---

    // 1. Merge data
    let masterQuestionData = [];
    Object.keys(questionMetadata).forEach(moduleName => {
        questionMetadata[moduleName].forEach(meta => {
            const submission = studentSubmissions.find(s => s.question_id === meta.question_id);
            masterQuestionData.push({ module: moduleName, ...meta, ...submission });
        });
    });

    // 2. Calculate Scores
    const rwRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'RW' && q.is_correct).length;
    const mathRawScore = masterQuestionData.filter(q => modulesConfig[q.module].type === 'Math' && q.is_correct).length;
    const totalRwQuestions = modulesConfig["English Module 1"].count + modulesConfig["English Module 2"].count;
    const totalMathQuestions = modulesConfig["Math Module 1"].count + modulesConfig["Math Module 2"].count;
    
    const rwScaledScore = getScaledScore(rwRawScore, 'RW');
    const mathScaledScore = getScaledScore(mathRawScore, 'Math');
    const totalScaledScore = rwScaledScore + mathScaledScore;

    // 3. Render Page
    // Scores
    document.getElementById('english-score').textContent = `${rwRawScore}/${totalRwQuestions} Raw | ${rwScaledScore} Scaled`;
    document.getElementById('math-score').textContent = `${mathRawScore}/${totalMathQuestions} Raw | ${mathScaledScore} Scaled`;
    document.getElementById('total-score').textContent = `${rwRawScore + mathRawScore}/${totalRwQuestions + totalMathQuestions} Raw | ${totalScaledScore} Scaled`;

    // Modules
    const modulesContainer = document.getElementById('modules-container');
    Object.keys(modulesConfig).forEach(moduleName => {
        const moduleWrapper = document.createElement('div');
        moduleWrapper.className = 'module';
        
        // Calculate module-specific raw score
        const questionsInModule = masterQuestionData.filter(q => q.module === moduleName);
        const moduleRawCorrect = questionsInModule.filter(q => q.is_correct).length;
        const totalModuleQuestions = questionsInModule.length;

        const header = document.createElement('div');
        header.className = 'module-header';
        header.textContent = `${moduleName} (${moduleRawCorrect}/${totalModuleQuestions})`; // Add score to header
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
            <div class="question-text">${q.question_text}</div>
            <p><strong>Your Choice:</strong> ${q.student_answer || "No Answer"}</p>
            <p><strong>Correct Choice:</strong> ${q.correct_answer}</p>
            <p><strong>Explanation:</strong></p>
            <pre>${q.explanation}</pre>
        `;

        feedbackContent.innerHTML = html;
        document.getElementById('feedback-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});
