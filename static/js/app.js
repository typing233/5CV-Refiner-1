const state = {
    resumeText: '',
    jobDescription: '',
    evaluationReport: null,
    markdownReport: '',
    optimizedText: '',
    selectedFile: null,
    issueFixResults: {},
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
            state.jobDescription = jd;
            state.markdownReport = report.markdown_report || '';
            // Use parsed text from backend (handles PDF/DOCX extraction)
            if (report.parsed_resume_text) {
                state.resumeText = report.parsed_resume_text;
            } else {
                state.resumeText = document.getElementById('resumeText').value.trim();
            }
            renderReport(report);
            renderIssuesList(report.issues || []);
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

    if (report.markdown_report) {
        container.innerHTML = marked.parse(report.markdown_report);
    } else {
        // Fallback: render from structured data
        let md = `# 简历评估报告\n\n## 综合评分：${report.overall_score} / 100\n\n`;
        md += `> ${report.summary}\n\n`;
        md += `## 各维度评分\n\n| 维度 | 评分 | 总评 |\n|------|------|------|\n`;
        for (const dim of (report.dimensions || [])) {
            md += `| ${dim.dimension} | ${dim.score}/10 | ${dim.summary} |\n`;
        }
        md += `\n## 问题清单\n\n`;
        for (const issue of (report.issues || [])) {
            md += `### ${issue.problem}\n\n`;
            md += `- **维度**：${issue.dimension}\n`;
            md += `- **影响**：${issue.impact}\n`;
            md += `- **建议**：${issue.suggestion}\n\n`;
        }
        container.innerHTML = marked.parse(md);
    }
}

function renderIssuesList(issues) {
    const container = document.getElementById('issuesList');
    document.getElementById('issuesPlaceholder').hidden = true;
    container.hidden = false;
    state.issueFixResults = {};

    if (!issues.length) {
        container.innerHTML = '<p class="placeholder">未发现需要修改的问题</p>';
        return;
    }

    let html = `<p class="issues-header">共 ${issues.length} 个问题，点击"修改此条"获取针对性修改建议：</p>`;

    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        html += `
            <div class="issue-edit-card" id="issue-card-${i}">
                <div class="issue-edit-header">
                    <span class="issue-badge">${issue.dimension}</span>
                    <span class="issue-location">${issue.location || ''}</span>
                </div>
                <div class="issue-edit-problem">${issue.problem}</div>
                <div class="issue-edit-impact">影响：${issue.impact}</div>
                <div class="issue-edit-suggestion">建议：${issue.suggestion}</div>
                <div class="issue-edit-actions">
                    <button class="btn btn-small" onclick="fixThisIssue(${i})">修改此条</button>
                    <button class="btn btn-accept" onclick="acceptIssueFix(${i})" hidden>采纳修改</button>
                    <button class="btn btn-reject" onclick="rejectIssueFix(${i})" hidden>放弃</button>
                </div>
                <div class="issue-fix-result markdown-body" id="issue-fix-${i}" hidden></div>
                <div class="issue-fix-status" id="issue-status-${i}"></div>
            </div>
        `;
    }

    container.innerHTML = html;
}

async function fixThisIssue(index) {
    const issue = state.evaluationReport.issues[index];
    const card = document.getElementById(`issue-card-${index}`);
    const resultEl = document.getElementById(`issue-fix-${index}`);
    const statusEl = document.getElementById(`issue-status-${index}`);
    const fixBtn = card.querySelector('.btn-small');

    fixBtn.disabled = true;
    fixBtn.textContent = '生成中...';
    resultEl.hidden = false;
    resultEl.innerHTML = '<p class="loading-text">正在生成修改建议...</p>';

    let accumulated = '';

    await fixIssue({
        resume_text: state.resumeText,
        job_description: state.jobDescription,
        issue: issue,
    }, {
        onToken: (token) => {
            accumulated += token;
            resultEl.innerHTML = marked.parse(accumulated);
        },
        onDone: () => {
            state.issueFixResults[index] = accumulated;
            fixBtn.hidden = true;
            card.querySelector('.btn-accept').hidden = false;
            card.querySelector('.btn-reject').hidden = false;
        },
        onError: (err) => {
            resultEl.innerHTML = `<p class="error-text">修改失败: ${err.message || '未知错误'}</p>`;
            fixBtn.disabled = false;
            fixBtn.textContent = '重试';
        },
    });
}

function acceptIssueFix(index) {
    const card = document.getElementById(`issue-card-${index}`);
    const statusEl = document.getElementById(`issue-status-${index}`);
    card.classList.add('issue-accepted');
    statusEl.innerHTML = '<span class="status-accepted">已采纳</span>';
    card.querySelector('.btn-accept').hidden = true;
    card.querySelector('.btn-reject').hidden = true;
    updateDraftFromFixes();
}

function rejectIssueFix(index) {
    const card = document.getElementById(`issue-card-${index}`);
    const statusEl = document.getElementById(`issue-status-${index}`);
    const resultEl = document.getElementById(`issue-fix-${index}`);
    card.classList.add('issue-rejected');
    statusEl.innerHTML = '<span class="status-rejected">已放弃</span>';
    card.querySelector('.btn-accept').hidden = true;
    card.querySelector('.btn-reject').hidden = true;
    resultEl.hidden = true;
    delete state.issueFixResults[index];
}

function updateDraftFromFixes() {
    // Show diff tab hint if there are accepted fixes
    const accepted = Object.keys(state.issueFixResults).filter(
        k => document.getElementById(`issue-card-${k}`).classList.contains('issue-accepted')
    );
    if (accepted.length > 0) {
        document.getElementById('diffPlaceholder').hidden = true;
        const diffContainer = document.getElementById('diffContent');
        diffContainer.hidden = false;

        let combinedFixes = '# 逐条修改汇总\n\n';
        for (const idx of accepted) {
            combinedFixes += state.issueFixResults[idx] + '\n\n---\n\n';
        }
        diffContainer.innerHTML = marked.parse(combinedFixes);
    }
}

function enablePostEval() {
    document.getElementById('btnEvaluate').disabled = false;
    document.getElementById('optimizedPlaceholder').hidden = true;
    document.getElementById('optimizedActions').hidden = false;
    document.getElementById('chatInput').disabled = false;
    document.getElementById('btnChat').disabled = false;
}

async function startOptimization() {
    showLoading('正在生成优化草稿...');
    let accumulated = '';
    const container = document.getElementById('optimizedContent');
    container.hidden = false;
    document.getElementById('optimizedActions').hidden = true;

    await optimizeResume({
        resume_text: state.resumeText,
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
            renderDiffView(state.resumeText, accumulated);
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
