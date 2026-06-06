const state = {
    resumeText: '',
    jobDescription: '',
    evaluationReport: null,
    optimizedText: '',
    selectedFile: null,
};

document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
    initTabs();
    initButtons();
    initChat();
    updateHealthStatus();
    setInterval(updateHealthStatus, 30000);
});

function initFileUpload() {
    const fileUpload = document.getElementById('fileUpload');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');

    fileUpload.addEventListener('click', () => fileInput.click());

    fileUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUpload.classList.add('dragover');
    });

    fileUpload.addEventListener('dragleave', () => {
        fileUpload.classList.remove('dragover');
    });

    fileUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUpload.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file) {
        const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validTypes.includes(ext)) {
            alert('不支持的文件格式，请上传 PDF、DOCX 或 TXT 文件');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('文件大小超过5MB限制');
            return;
        }
        state.selectedFile = file;
        fileName.textContent = file.name;
        document.getElementById('resumeText').value = '';
        validateForm();
    }

    document.getElementById('resumeText').addEventListener('input', () => {
        if (document.getElementById('resumeText').value.trim()) {
            state.selectedFile = null;
            fileName.textContent = '';
        }
        validateForm();
    });

    document.getElementById('jobDescription').addEventListener('input', validateForm);
}

function validateForm() {
    const hasResume = state.selectedFile || document.getElementById('resumeText').value.trim();
    const hasJD = document.getElementById('jobDescription').value.trim();
    document.getElementById('btnEvaluate').disabled = !(hasResume && hasJD);
}

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });
}

function initButtons() {
    document.getElementById('btnEvaluate').addEventListener('click', startEvaluation);
    document.getElementById('btnOptimize').addEventListener('click', startOptimization);
}

function initChat() {
    const chatInput = document.getElementById('chatInput');
    const btnChat = document.getElementById('btnChat');

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    btnChat.addEventListener('click', sendChatMessage);
}

async function startEvaluation() {
    const formData = new FormData();
    const jd = document.getElementById('jobDescription').value.trim();
    formData.append('job_description', jd);

    if (state.selectedFile) {
        formData.append('resume_file', state.selectedFile);
    } else {
        formData.append('resume_text', document.getElementById('resumeText').value.trim());
    }

    showLoading('正在评估简历...');
    document.getElementById('btnEvaluate').disabled = true;

    await evaluateResume(formData, {
        onStatus: (data) => {
            document.getElementById('loadingText').textContent = data.message || data.stage;
        },
        onResult: (report) => {
            state.evaluationReport = report;
            state.resumeText = state.selectedFile
                ? '(从文件提取)'
                : document.getElementById('resumeText').value.trim();
            state.jobDescription = jd;
            renderReport(report);
            hideLoading();
            enablePostEval();
        },
        onError: (err) => {
            hideLoading();
            alert('评估失败: ' + (err.message || '未知错误'));
            document.getElementById('btnEvaluate').disabled = false;
        },
    });
}

function renderReport(report) {
    const container = document.getElementById('reportContent');
    document.getElementById('reportPlaceholder').hidden = true;
    container.hidden = false;

    let html = `
        <div class="overall-score">
            <span class="big-score">${report.overall_score}</span>
            <span class="score-suffix"> / 100</span>
        </div>
        <div class="score-card">
    `;

    for (const dim of report.dimensions) {
        html += `
            <div class="score-item">
                <div class="score-value">${dim.score}</div>
                <div class="score-label">${dim.dimension}</div>
            </div>
        `;
    }

    html += `</div><h3>评估总结</h3><p>${report.summary}</p>`;
    html += `<h3 style="margin-top:20px">问题清单 (${report.issues.length}项)</h3>`;

    for (const issue of report.issues) {
        html += `
            <div class="issue-card">
                <div class="issue-dimension">${issue.dimension}</div>
                <div class="issue-problem">${issue.problem}</div>
                <div class="issue-impact">⚠ 影响: ${issue.impact}</div>
                <div class="issue-suggestion">✓ 建议: ${issue.suggestion}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function enablePostEval() {
    document.getElementById('btnEvaluate').disabled = false;
    document.getElementById('optimizedPlaceholder').hidden = true;
    document.getElementById('optimizedActions').hidden = false;
    document.getElementById('chatInput').disabled = false;
    document.getElementById('btnChat').disabled = false;
}

async function startOptimization() {
    const resumeText = state.selectedFile
        ? document.getElementById('resumeText').value.trim() || '(文件内容已上传，请重新粘贴原始文本以对比)'
        : document.getElementById('resumeText').value.trim();

    showLoading('正在生成优化草稿...');
    let accumulated = '';
    const container = document.getElementById('optimizedContent');
    container.hidden = false;
    document.getElementById('optimizedActions').hidden = true;

    await optimizeResume({
        resume_text: resumeText,
        job_description: state.jobDescription,
        issues: state.evaluationReport ? state.evaluationReport.issues : [],
    }, {
        onStatus: (data) => {
            document.getElementById('loadingText').textContent = data.message || '生成中...';
        },
        onToken: (token) => {
            hideLoading();
            accumulated += token;
            container.innerHTML = marked.parse(accumulated);
        },
        onDone: () => {
            state.optimizedText = accumulated;
            hideLoading();
            renderDiffView(resumeText, accumulated);
        },
        onError: (err) => {
            hideLoading();
            alert('优化失败: ' + (err.message || '未知错误'));
            document.getElementById('optimizedActions').hidden = false;
        },
    });
}

function renderDiffView(original, optimized) {
    const diffContainer = document.getElementById('diffContent');
    document.getElementById('diffPlaceholder').hidden = true;
    diffContainer.hidden = false;

    const cleanOptimized = optimized.replace(/<!--.*?-->/g, '');
    const diffResult = computeDiff(original, cleanOptimized);
    diffContainer.innerHTML = renderDiff(diffResult);
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    appendChatMsg('user', question);

    const msgEl = appendChatMsg('assistant', '');
    let accumulated = '';

    await chatMessage({
        question,
        resume_text: state.resumeText,
        job_description: state.jobDescription,
        evaluation_summary: state.evaluationReport ? state.evaluationReport.summary : '',
    }, {
        onToken: (token) => {
            accumulated += token;
            msgEl.querySelector('.msg-bubble').innerHTML = marked.parse(accumulated);
            scrollChat();
        },
        onError: (err) => {
            msgEl.querySelector('.msg-bubble').textContent = '回答失败: ' + (err.message || '未知错误');
        },
    });
}

function appendChatMsg(role, text) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `<div class="msg-bubble">${text ? marked.parse(text) : ''}</div>`;
    container.appendChild(div);
    scrollChat();
    return div;
}

function scrollChat() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').hidden = false;
}

function hideLoading() {
    document.getElementById('loadingOverlay').hidden = true;
}

async function updateHealthStatus() {
    const health = await checkHealth();
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');

    indicator.className = 'status-indicator';
    if (health.ollama_available && health.model_loaded) {
        indicator.classList.add('connected');
        text.textContent = '模型就绪';
    } else if (health.ollama_available) {
        indicator.classList.add('connected');
        text.textContent = '模型未加载';
    } else {
        indicator.classList.add('disconnected');
        text.textContent = 'Ollama未连接';
    }
}
