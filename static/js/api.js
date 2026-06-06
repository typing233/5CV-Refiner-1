async function streamFetch(url, options, callbacks) {
    const { onStatus, onToken, onResult, onError, onDone } = callbacks;

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
            if (onError) onError(err);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    const raw = line.slice(6);
                    try {
                        const data = JSON.parse(raw);
                        switch (currentEvent) {
                            case 'status':
                                if (onStatus) onStatus(data);
                                break;
                            case 'token':
                                if (onToken) onToken(data.content);
                                break;
                            case 'result':
                                if (onResult) onResult(data);
                                break;
                            case 'error':
                                if (onError) onError(data);
                                break;
                            case 'done':
                                if (onDone) onDone(data);
                                break;
                        }
                    } catch (e) {
                        // non-JSON data line, ignore
                    }
                }
            }
        }
    } catch (e) {
        if (onError) onError({ code: 'NETWORK_ERROR', message: '网络连接失败: ' + e.message });
    }
}

async function evaluateResume(formData, callbacks) {
    return streamFetch('/api/evaluate', {
        method: 'POST',
        body: formData,
    }, callbacks);
}

async function optimizeResume(data, callbacks) {
    return streamFetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }, callbacks);
}

async function chatMessage(data, callbacks) {
    return streamFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }, callbacks);
}

async function checkHealth() {
    try {
        const resp = await fetch('/api/health');
        return await resp.json();
    } catch (e) {
        return { status: 'error', ollama_available: false, model_loaded: false };
    }
}

async function fixIssue(data, callbacks) {
    return streamFetch('/api/fix-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }, callbacks);
}
