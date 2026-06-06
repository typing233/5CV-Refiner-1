function computeDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result = [];

    const maxLen = Math.max(oldLines.length, newLines.length);
    let i = 0, j = 0;

    while (i < oldLines.length || j < newLines.length) {
        if (i >= oldLines.length) {
            result.push({ type: 'add', text: newLines[j] });
            j++;
        } else if (j >= newLines.length) {
            result.push({ type: 'del', text: oldLines[i] });
            i++;
        } else if (oldLines[i] === newLines[j]) {
            result.push({ type: 'ctx', text: oldLines[i] });
            i++;
            j++;
        } else {
            let foundInNew = newLines.indexOf(oldLines[i], j);
            let foundInOld = oldLines.indexOf(newLines[j], i);

            if (foundInNew !== -1 && (foundInOld === -1 || foundInNew - j <= foundInOld - i)) {
                while (j < foundInNew) {
                    result.push({ type: 'add', text: newLines[j] });
                    j++;
                }
            } else if (foundInOld !== -1) {
                while (i < foundInOld) {
                    result.push({ type: 'del', text: oldLines[i] });
                    i++;
                }
            } else {
                result.push({ type: 'del', text: oldLines[i] });
                result.push({ type: 'add', text: newLines[j] });
                i++;
                j++;
            }
        }
    }

    return result;
}

function renderDiff(diffResult) {
    return diffResult.map(line => {
        const prefix = line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  ';
        const cls = 'diff-' + line.type;
        const escaped = line.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="diff-line ${cls}">${prefix}${escaped}</div>`;
    }).join('');
}
