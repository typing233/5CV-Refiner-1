const state = {
    resumeText: '',
    draftText: '',
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
            if (report.parsed_resume_text) {
                state.resumeText = report.parsed_resume_text;
            } else {
                state.resumeText = document.getElementById('resumeText').value.trim();
            }
            // Initialize draft as a copy of original
            state.draftText = state.resumeText;
            state.issueFixResults = {};
            state.optimizedText = '';

            renderReport(report);
            renderIssuesList(report.issues || []);
            renderDraftPreview();
            renderDiffView();
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
    document.getElementById('issuesContainer').hidden = false;

    if (!issues.length) {
        container.innerHTML = '<p class="placeholder">未发现需要修改的问题</p>';
        return;
    }

    let html = `<p class="issues-header">共 ${issues.length} 个问题，点击"修改此条"获取针对性修改建议，采纳后自动应用到草稿：</p>`;

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
                <div class="issue-fix-result" id="issue-fix-${i}" hidden>
                    <div class="fix-before" id="fix-before-${i}"></div>
                    <div class="fix-after" id="fix-after-${i}"></div>
                    <div class="fix-reason" id="fix-reason-${i}"></div>
                </div>
                <div class="issue-fix-status" id="issue-status-${i}"></div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderDraftPreview() {
    const container = document.getElementById('draftContent');
    if (!state.draftText) {
        container.innerHTML = '<p class="placeholder">暂无草稿</p>';
        return;
    }
    // Render as preformatted text to preserve resume structure
    const escaped = state.draftText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    container.innerHTML = `<pre class="draft-pre">${escaped}</pre>`;
}

function renderDiffView() {
    const diffContainer = document.getElementById('diffContent');
    document.getElementById('diffPlaceholder').hidden = true;
    diffContainer.hidden = false;

    if (state.resumeText === state.draftText && !state.optimizedText) {
        diffContainer.innerHTML = '<p class="diff-empty">草稿尚无改动，采纳逐条修改或生成整篇优化后可查看对比</p>';
        return;
    }

    const compareTarget = state.optimizedText || state.draftText;
    const diffResult = computeDiff(state.resumeText, compareTarget);
    diffContainer.innerHTML = renderDiff(diffResult);
}

// Parse the structured fix output from LLM
function parseFixResponse(text) {
    const beforeMatch = text.match(/\[原文开始\]\s*\n([\s\S]*?)\n\s*\[原文结束\]/);
    const afterMatch = text.match(/\[修改开始\]\s*\n([\s\S]*?)\n\s*\[修改结束\]/);
    const reasonMatch = text.match(/\[说明\]\s*\n([\s\S]*?)$/);

    if (beforeMatch && afterMatch) {
        return {
            before: beforeMatch[1].trim(),
            after: afterMatch[1].trim(),
            reason: reasonMatch ? reasonMatch[1].trim() : '',
            raw: text,
        };
    }

    // Fallback: try markdown-style headers
    const mdBefore = text.match(/###?\s*修改前[\s\S]*?>\s*([\s\S]*?)(?=###?\s*修改后)/);
    const mdAfter = text.match(/###?\s*修改后\s*\n([\s\S]*?)(?=###?\s*修改说明|$)/);
    const mdReason = text.match(/###?\s*修改说明\s*\n([\s\S]*?)$/);

    if (mdBefore && mdAfter) {
        return {
            before: mdBefore[1].replace(/^>\s*/gm, '').trim(),
            after: mdAfter[1].trim(),
            reason: mdReason ? mdReason[1].trim() : '',
            raw: text,
        };
    }

    // Can't parse structure, return raw
    return { before: '', after: '', reason: '', raw: text };
}

async function fixThisIssue(index) {
    const issue = state.evaluationReport.issues[index];
    const card = document.getElementById(`issue-card-${index}`);
    const resultEl = document.getElementById(`issue-fix-${index}`);
    const fixBtn = card.querySelector('.btn-small');

    fixBtn.disabled = true;
    fixBtn.textContent = '生成中...';
    resultEl.hidden = false;
    resultEl.innerHTML = '<p class="loading-text">正在生成修改建议...</p>';

    let accumulated = '';

    await fixIssue({
        resume_text: state.draftText,
        job_description: state.jobDescription,
        issue: issue,
    }, {
        onToken: (token) => {
            accumulated += token;
            resultEl.innerHTML = `<pre class="fix-preview">${escapeHtml(accumulated)}</pre>`;
        },
        onDone: () => {
            const parsed = parseFixResponse(accumulated);
            state.issueFixResults[index] = parsed;

            // Render structured preview
            let previewHtml = '';
            if (parsed.before) {
                previewHtml += `<div class="fix-section"><span class="fix-label">原文：</span><div class="fix-before-text">${escapeHtml(parsed.before)}</div></div>`;
                previewHtml += `<div class="fix-section"><span class="fix-label">修改为：</span><div class="fix-after-text">${escapeHtml(parsed.after)}</div></div>`;
                if (parsed.reason) {
                    previewHtml += `<div class="fix-section"><span class="fix-label">原因：</span><span class="fix-reason-text">${escapeHtml(parsed.reason)}</span></div>`;
                }
            } else {
                previewHtml = `<div class="fix-section markdown-body">${marked.parse(accumulated)}</div>`;
            }
            resultEl.innerHTML = previewHtml;

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
    const parsed = state.issueFixResults[index];

    // Apply the fix to the draft
    if (parsed && parsed.before && parsed.after) {
        const applied = applyFixToDraft(parsed.before, parsed.after);
        if (applied) {
            statusEl.innerHTML = '<span class="status-accepted">已采纳并应用到草稿</span>';
        } else {
            statusEl.innerHTML = '<span class="status-accepted">已采纳（未能精确定位原文，请在草稿中手动确认）</span>';
        }
    } else {
        statusEl.innerHTML = '<span class="status-accepted">已采纳（请参考建议手动修改草稿）</span>';
    }

    card.classList.add('issue-accepted');
    card.querySelector('.btn-accept').hidden = true;
    card.querySelector('.btn-reject').hidden = true;

    renderDraftPreview();
    renderDiffView();
}

function applyFixToDraft(before, after) {
    // Try exact match first
    if (state.draftText.includes(before)) {
        state.draftText = state.draftText.replace(before, after);
        return true;
    }

    // Try normalized match (collapse whitespace)
    const normBefore = before.replace(/\s+/g, ' ').trim();
    const lines = state.draftText.split('\n');
    let windowText = '';
    let startLine = -1;
    let endLine = -1;

    // Sliding window over lines to find best match
    for (let i = 0; i < lines.length; i++) {
        windowText = '';
        for (let j = i; j < lines.length && j < i + 10; j++) {
            windowText += (j > i ? ' ' : '') + lines[j].trim();
            const normWindow = windowText.replace(/\s+/g, ' ').trim();
            if (normWindow === normBefore || normWindow.includes(normBefore)) {
                startLine = i;
                endLine = j;
                break;
            }
        }
        if (startLine >= 0) break;
    }

    if (startLine >= 0) {
        const beforeLines = lines.slice(0, startLine);
        const afterLines = lines.slice(endLine + 1);
        state.draftText = [...beforeLines, after, ...afterLines].join('\n');
        return true;
    }

    // Try substring match (at least 60% of before text found)
    const beforeWords = before.split(/\s+/);
    if (beforeWords.length >= 3) {
        const searchPhrase = beforeWords.slice(0, Math.ceil(beforeWords.length * 0.6)).join(' ');
        const idx = state.draftText.indexOf(searchPhrase);
        if (idx >= 0) {
            // Find the line range
            const textBefore = state.draftText.substring(0, idx);
            const lineStart = textBefore.lastIndexOf('\n') + 1;
            const remainAfter = state.draftText.substring(idx);
            const lineEnd = idx + (remainAfter.indexOf('\n') >= 0 ? remainAfter.indexOf('\n') : remainAfter.length);
            state.draftText = state.draftText.substring(0, lineStart) + after + '\n' + state.draftText.substring(lineEnd);
            return true;
        }
    }

    return false;
}

function rejectIssueFix(index) {
    const card = document.getElementById(`issue-card-${index}`);
    const statusEl = document.getElementById(`issue-status-${index}`);
    const resultEl = document.getElementById(`issue-fix-${index}`);

    card.classList.add('issue-rejected');
    statusEl.innerHTML = '<span class="status-rejected">已跳过</span>';
    card.querySelector('.btn-accept').hidden = true;
    card.querySelector('.btn-reject').hidden = true;
    resultEl.hidden = true;
    delete state.issueFixResults[index];
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
        resume_text: state.draftText,
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
            renderDiffView();
        },
        onError: (err) => {
            hideLoading();
            alert('优化失败: ' + (err.message || '未知错误'));
            document.getElementById('optimizedActions').hidden = false;
        },
    });
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

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
