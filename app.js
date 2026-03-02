// --- CONFIGURATION & STATE ---
let testData = { questions: [], userResponses: {}, timeSpent: {}, mistakes: {} };
let currentQuestionIndex = 0;
let timerInterval;
let totalSeconds = 180 * 60;
let subjectMovement = []; // Tracks [{subject: 'Math', time: Date.now()}]

// --- 1. PDF EXTRACTION LOGIC ---
document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";

        // UI Update: Show Loading
        document.querySelector('.upload-area h3').innerText = "Extracting Text & Diagrams...";
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(s => s.str).join(" ") + "\n";
        }
        
        processWithAI(fullText);
    };
    reader.readAsArrayBuffer(file);
});

// --- 2. AI PROCESSING (GEMINI API) ---
async function processWithAI(text) {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        alert("Please enter your Gemini API Key first!");
        return;
    }

    const prompt = `
    You are a JEE Exam Parser. Convert the following text into a structured JSON for a CBT test.
    Extract: Question Statement, Options (A,B,C,D), Subject, Chapter, and Correct Answer (if found).
    Format: 
    { "questions": [ {"id": "Q1", "subject": "Physics", "chapter": "Rotational", "question": "...", "options": {"A":"","B":"","C":"","D":""}, "correct": "A", "type": "MCQ"} ] }
    
    TEXT: ${text.substring(0, 15000)} // Sending first 15k chars for stability
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        const jsonString = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '');
        testData.questions = JSON.parse(jsonString).questions;
        
        alert("Test Generated Successfully!");
        startCBT();
    } catch (error) {
        console.error("AI Error:", error);
        alert("Failed to parse PDF. Check API Key or PDF format.");
    }
}

// --- 3. CBT ENGINE LOGIC ---
function startCBT() {
    document.getElementById('view-create-test').style.display = 'none';
    document.getElementById('cbt-engine').style.display = 'flex';
    renderQuestion(0);
    startTimer();
}

function renderQuestion(index) {
    currentQuestionIndex = index;
    const q = testData.questions[index];
    
    // Update Question UI
    document.getElementById('q-number').innerText = `Question ${index + 1} (${q.subject})`;
    document.getElementById('q-text').innerText = q.question;
    
    let optionsHtml = "";
    for (let key in q.options) {
        const isSelected = testData.userResponses[index] === key;
        optionsHtml += `
            <div class="card" onclick="selectOption('${key}')" style="cursor:pointer; border:${isSelected ? '2px solid var(--primary)' : '1px solid var(--border)'}">
                <strong>${key}.</strong> ${q.options[key]}
            </div>
        `;
    }
    document.getElementById('q-options').innerHTML = optionsHtml;
    renderPalette();
}

function selectOption(key) {
    testData.userResponses[currentQuestionIndex] = key;
    renderQuestion(currentQuestionIndex);
}

function renderPalette() {
    const palette = document.getElementById('q-palette');
    palette.innerHTML = testData.questions.map((q, i) => {
        let statusClass = "";
        if (testData.userResponses[i]) statusClass = "q-answered";
        return `<div class="q-bubble ${statusClass}" onclick="renderQuestion(${i})">${i + 1}</div>`;
    }).join('');
}

function startTimer() {
    timerInterval = setInterval(() => {
        totalSeconds--;
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        document.getElementById('timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (totalSeconds <= 0) submitTest();
    }, 1000);
}

// --- 4. ADVANCED ANALYSIS LOGIC ---
function submitTest() {
    clearInterval(timerInterval);
    document.getElementById('cbt-engine').style.display = 'none';
    document.getElementById('analysis-dashboard').style.display = 'block';
    
    generateAdvancedAnalytics();
}

function generateAdvancedAnalytics() {
    let score = 0;
    let correct = 0;
    let incorrect = 0;

    testData.questions.forEach((q, i) => {
        if (testData.userResponses[i] === q.correct) {
            score += 4;
            correct++;
        } else if (testData.userResponses[i]) {
            score -= 1;
            incorrect++;
        }
    });

    // Update Analysis UI Values
    document.querySelector('.card-value').innerText = `${score} / ${testData.questions.length * 4}`;
    
    // Logic for "Score Potential" (Score if 0 incorrects)
    const potential = score + (incorrect * 1); // Recovering negative marks
    
    renderPotentialChart(score, potential);
}

function renderPotentialChart(actual, potential) {
    const ctx = document.getElementById('scorePotentialChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Actual', '25% Error Red.', '50% Error Red.', '75% Error Red.', '100% Potential'],
            datasets: [{
                label: 'Score Growth',
                data: [actual, actual + (potential-actual)*0.25, actual + (potential-actual)*0.5, actual + (potential-actual)*0.75, potential],
                borderColor: '#4F46E5',
                fill: true,
                backgroundColor: 'rgba(79, 70, 229, 0.1)'
            }]
        }
    });
}

// Initialize Dropzone
const dropzone = document.getElementById('pdf-dropzone');
dropzone.onclick = () => document.getElementById('file-upload').click();
