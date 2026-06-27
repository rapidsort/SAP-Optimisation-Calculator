document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Calculation Logic
    const calculateBtn = document.getElementById('calculate-btn');
    const resultArea = document.getElementById('result-area');
    const copyBtn = document.getElementById('copy-btn');

    // Load saved inputs
    const loadLocalStorage = () => {
        const result = {
            weeklyTraffic: localStorage.getItem('weeklyTraffic'),
            weeklyConversions: localStorage.getItem('weeklyConversions'),
            variants: localStorage.getItem('variants'),
            duration: localStorage.getItem('duration'),
            confidence: localStorage.getItem('confidence'),
            power: localStorage.getItem('power'),
            preTestType: localStorage.getItem('preTestType'),
            preTestMode: localStorage.getItem('preTestMode'),
            desiredMDE: localStorage.getItem('desiredMDE'),
            postTestVisitors: JSON.parse(localStorage.getItem('postTestVisitors') || 'null'),
            postTestConfidence: localStorage.getItem('postTestConfidence'),
            postTestType: localStorage.getItem('postTestType'),
            postTestMetrics: JSON.parse(localStorage.getItem('postTestMetrics') || 'null'),
            trafficSplit: localStorage.getItem('trafficSplit')
        };

        if (result.weeklyTraffic) document.getElementById('weekly-traffic').value = result.weeklyTraffic;
        if (result.weeklyConversions) document.getElementById('weekly-conversions').value = result.weeklyConversions;
        if (result.variants) {
            document.getElementById('variants').value = result.variants;
            updateTrafficSplitUI(parseInt(result.variants));
        }
        if (result.trafficSplit) document.getElementById('traffic-split').value = result.trafficSplit;
        if (result.duration) document.getElementById('duration').value = result.duration;
        if (result.confidence) document.getElementById('confidence').value = result.confidence;
        if (result.power) document.getElementById('power').value = result.power;

        if (result.power) document.getElementById('power').value = result.power;

        // Restore Test Type (Pre-Test)
        if (result.preTestType) {
            const radio = document.querySelector(`input[name="pre-test-type"][value="${result.preTestType}"]`);
            if (radio) radio.checked = true;
        }

        // Restore Pre-Text Mode (Find MDE vs Find Duration)
        if (result.preTestMode) {
            switchPreTestMode(result.preTestMode);
        } else {
            switchPreTestMode('find-mde'); // Default
        }

        // Restore Desired MDE
        if (result.desiredMDE) document.getElementById('desired-mde').value = result.desiredMDE;

        // Restore Post-Test Inputs
        if (result.postTestVisitors) {
            document.getElementById('control-visitors').value = result.postTestVisitors.control;
            document.getElementById('variant-visitors').value = result.postTestVisitors.variant;
        }
        if (result.postTestConfidence) {
            document.getElementById('post-test-confidence').value = result.postTestConfidence;
        }
        if (result.postTestType) {
            const ptRadio = document.querySelector(`input[name="test-type"][value="${result.postTestType}"]`);
            if (ptRadio) ptRadio.checked = true;
        }

        // Restore Metrics
        const metricsContainer = document.getElementById('metrics-container');
        // Clear existing default row if we have saved metrics, or just append? 
        // The HTML has a default "Primary KPI" row. If we saved data, we should probably replace it or fill it.
        // Strategy: Clear container and rebuild from saved data. If no saved data, keep default HTML or ensure at least one row.
        if (result.postTestMetrics && result.postTestMetrics.length > 0) {
            metricsContainer.innerHTML = ''; // Clear default
            result.postTestMetrics.forEach(metric => {
                createMetricRow(metricsContainer, metric.name, metric.valA, metric.valB);
            });
        } else {
            // If no saved metrics, ensure we have the default one attached with listeners
            // Actually, the default one in HTML lacks the removal listener if not added via JS.
            // But existing code attaches listener to created rows. The default row in HTML is static.
            // We should attach listeners to static/existing rows or just make them consistent.
            // Let's attach listener to the existing static row if it exists.
            const staticRow = metricsContainer.querySelector('.metric-row');
            if (staticRow && !staticRow.dataset.listenerAttached) {
                // We don't have a remove button on the default static row in HTML usually? 
                // Checked HTML: Default row doesn't have remove button. 
                // We'll leave it as is or add change listener for saving.
                attachAutoSaveToRow(staticRow);
            }
        }
    };

    // Call load immediately
    loadLocalStorage();

    const modeBtns = document.querySelectorAll('.segmented-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchPreTestMode(mode);
            // Save mode
            localStorage.setItem('preTestMode', mode);
        });
    });

    calculateBtn.addEventListener('click', () => {
        const traffic = parseFloat(document.getElementById('weekly-traffic').value) || 0;
        const conversions = parseFloat(document.getElementById('weekly-conversions').value) || 0;
        const variants = parseInt(document.getElementById('variants').value) || 2;
        const duration = parseInt(document.getElementById('duration').value) || 30;
        const desiredMDE = parseFloat(document.getElementById('desired-mde').value) || 0;
        const confidence = parseInt(document.getElementById('confidence').value) || 90;
        const power = parseInt(document.getElementById('power').value) || 80;
        const trafficSplit = parseInt(document.getElementById('traffic-split').value) || 50;

        // Get test type
        const testTypeInput = document.querySelector('input[name="pre-test-type"]:checked');
        const isTwoSided = testTypeInput ? testTypeInput.value === 'two-sided' : true;

        // Get current mode
        const activeModeBtn = document.querySelector('.segmented-btn.active');
        const currentMode = activeModeBtn ? activeModeBtn.dataset.mode : 'find-mde';

        // Save inputs
        chrome.storage.local.set({
            weeklyTraffic: traffic,
            weeklyConversions: conversions,
            variants: variants,
            duration: duration,
            desiredMDE: desiredMDE,
            confidence: confidence,
            power: power,
            preTestType: isTwoSided ? 'two-sided' : 'one-sided',
            preTestMode: currentMode,
            trafficSplit: trafficSplit
        });

        if (traffic === 0) {
            alert('Please enter valid traffic.');
            return;
        }

        if (currentMode === 'find-mde') {
            if (duration === 0) {
                alert('Please enter valid duration.');
                return;
            }
            const result = calculateTargetRate(traffic, conversions, variants, duration, confidence, power, isTwoSided, trafficSplit);
            const outputHtml = generateOutput(traffic, conversions, result.targetRate, duration, confidence, power, result.mdeRelative, variants, trafficSplit);
            document.getElementById('output-text').innerHTML = outputHtml;
        } else {
            // Find Duration Mode
            if (desiredMDE === 0) {
                alert('Please enter a desired MDE.');
                return;
            }
            const daysRequired = calculateDuration(traffic, conversions, variants, desiredMDE, confidence, power, isTwoSided, trafficSplit);
            const outputHtml = generateDurationOutput(traffic, conversions, variants, desiredMDE, daysRequired, confidence, power, trafficSplit);
            document.getElementById('output-text').innerHTML = outputHtml;
        }

        resultArea.classList.remove('hidden');
        savePreTestInputs(); // Save on calculation as well
    });

    // Auto-save Pre-Test inputs
    const preTestInputs = [
        'weekly-traffic', 'weekly-conversions', 'variants', 'duration', 'desired-mde', 'confidence', 'power'
    ];
    preTestInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                if (id === 'variants') {
                    updateTrafficSplitUI(parseInt(e.target.value));
                }
                savePreTestInputs();
            });
            el.addEventListener('change', (e) => {
                if (id === 'variants') {
                    updateTrafficSplitUI(parseInt(e.target.value));
                }
                savePreTestInputs();
            });
        }
    });

    document.querySelectorAll('input[name="pre-test-type"]').forEach(r => {
        r.addEventListener('change', savePreTestInputs);
    });

    const clearPreBtn = document.getElementById('clear-pre-test-btn');
    if (clearPreBtn) {
        clearPreBtn.addEventListener('click', clearPreTestInputs);
    }

    copyBtn.addEventListener('click', () => {
        const htmlContent = document.getElementById('output-text').innerHTML;
        const plainText = document.getElementById('output-text').innerText;

        // Try to write rich text (HTML) and plain text to clipboard
        try {
            const blobHtml = new Blob([htmlContent], { type: 'text/html' });
            const blobText = new Blob([plainText], { type: 'text/plain' });
            const data = [new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            })];

            navigator.clipboard.write(data).then(() => {
                showCopyFeedback();
            });
        } catch (e) {
            // Fallback to plain text if rich copy is not supported/permitted
            navigator.clipboard.writeText(plainText).then(() => {
                showCopyFeedback();
            });
        }
    });

    // Handle External Links in Help Section
    const helpTab = document.getElementById('help-tab');
    if (helpTab) {
        helpTab.addEventListener('click', (e) => {
            const target = e.target.closest('a');
            if (target && target.href) {
                e.preventDefault();
                const url = target.href;
                if (url.startsWith('mailto:')) {
                    window.open(url, '_blank');
                } else {
                    chrome.tabs.create({ url: url });
                }
            }
        });
    }
});

function showCopyFeedback() {
    const copyBtn = document.getElementById('copy-btn');
    const originalIcon = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span style="font-size: 10px;">Copied!</span>';
    setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
    }, 1500);
}

function switchPreTestMode(mode) {
    const modeBtns = document.querySelectorAll('.segmented-btn');
    const groupDuration = document.getElementById('group-duration');
    const groupDesiredMde = document.getElementById('group-desired-mde');
    const calcBtn = document.getElementById('calculate-btn');

    modeBtns.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (mode === 'find-mde') {
        groupDuration.style.display = 'block';
        groupDesiredMde.style.display = 'none';
        calcBtn.textContent = 'Calculate MDE';
    } else {
        groupDuration.style.display = 'none';
        groupDesiredMde.style.display = 'block';
        calcBtn.textContent = 'Calculate Duration';
    }
}

function getPowerScore(power) {
    // Speero appears to use simplified 0.85 for 80%
    if (power === 80) return 0.85;
    if (power === 90) return 1.282;
    return 0.85; // Default 80%
}

function updateTrafficSplitUI(variants) {
    const inputSplit = document.getElementById('traffic-split');
    if (inputSplit) {
        if (variants === 2) {
            inputSplit.disabled = false;
            // When returning to 2 variants, reset to 50 if it was auto-calculated
            if (inputSplit.value.includes('.') || (100 / variants).toFixed(1) === inputSplit.value) {
                inputSplit.value = "50";
            }
        } else {
            inputSplit.disabled = true;
            inputSplit.value = (100 / variants).toFixed(1);
        }
    }
}

function calculateTargetRate(traffic, conversions, variants, duration, confidence, power, isTwoSided = true, trafficSplit = 50) {
    // 1. Calculate baseline conversion rate (p)
    let p = conversions / traffic;
    if (p <= 0) p = 0.001;
    if (p >= 1) p = 0.999;

    // 2. Calculate Total Sample Size available (N)
    const totalTraffic = (traffic / 7) * duration;

    // 3. Constant for Z-scores
    const z_alpha = getZScore(confidence, isTwoSided);
    const z_beta = getPowerScore(power);

    // 4. Calculate MDE (Absolute)
    // If variants > 2, we assume equal split for now.
    // If variants == 2, we use trafficSplit (percentage to variant).
    let mde_absolute;
    if (variants === 2) {
        const ratio = trafficSplit / 100;
        mde_absolute = solveMDEUnequal(totalTraffic, p, z_alpha, z_beta, ratio);
    } else {
        const n = totalTraffic / variants;
        mde_absolute = solveMDE(n, p, z_alpha, z_beta);
    }

    // 5. Calculate Target Rate (Base + MDE Absolute)
    const target_rate = p + mde_absolute;

    return {
        mdeAbs: mde_absolute,
        targetRate: (target_rate * 100).toFixed(2),
        mdeRelative: ((mde_absolute / p) * 100).toFixed(2)
    };
}

function getZScore(confidence, twoSided = false) {
    // One-Sided Z-scores (Standard for CRO MDE calculators like Speero)
    if (!twoSided) {
        if (confidence === 90) return 1.282;
        if (confidence === 95) return 1.645;
        if (confidence === 99) return 2.326;
        return 1.282;
    }
    // Two-Sided Z-scores
    // Speero appears to use simplified 1.65 for 90%
    if (confidence === 90) return 1.65;
    if (confidence === 95) return 1.960;
    if (confidence === 99) return 2.576;
    return 1.65;
}

function solveMDE(n, p, z_alpha, z_beta) {
    // ArcSine Transformation (Cohen's h) Formula
    // Standard Arcsine implementation.
    const arcsin_p = Math.asin(Math.sqrt(p));
    const term = (z_alpha + z_beta) / Math.sqrt(2 * n);

    const p_target = Math.pow(Math.sin(arcsin_p + term), 2);

    return p_target - p;
}

function solveMDEUnequal(N, p, z_alpha, z_beta, ratio) {
    // ratio is variant split (e.g. 0.1 for 10%)
    // Variance of difference in Arcsine proportions: 1 / (4 * N * ratio * (1-ratio))
    // Standard deviation: 1 / (2 * sqrt(N * ratio * (1-ratio)))
    const arcsin_p = Math.asin(Math.sqrt(p));
    const sigma = 1 / (2 * Math.sqrt(N * ratio * (1 - ratio)));
    const term = (z_alpha + z_beta) * sigma / Math.sqrt(2);
    // Wait, the standard Arcsine formula for difference is (asin(sqrt(p1)) - asin(sqrt(p2))) ~ (z_alpha+z_beta) * sqrt(1/(4n1) + 1/(4n2))
    // Delta_asin = (z_alpha + z_beta) * 0.5 * sqrt(1/n1 + 1/n2)

    const n1 = (1 - ratio) * N;
    const n2 = ratio * N;
    const delta_asin = (z_alpha + z_beta) * 0.5 * Math.sqrt(1 / n1 + 1 / n2);

    const p_target = Math.pow(Math.sin(arcsin_p + delta_asin), 2);
    return p_target - p;
}

function generateOutput(traffic, conversions, targetRate, duration, confidence, power, mdeRelative, variants, trafficSplit) {
    // Calculate daily rates
    const dailyTraffic = traffic / 7;
    const dailyConversions = conversions / 7;

    // Scale to duration
    const priorUsers = Math.round(dailyTraffic * duration);
    const priorConversions = Math.round(dailyConversions * duration);

    const baselineRate = ((conversions / traffic) * 100).toFixed(2);

    let splitText = "";
    if (variants === 2) {
        splitText = `(${100 - trafficSplit}/${trafficSplit} split)`;
    }

    return `<div><strong>Prior Data</strong></div>
<ul><li>Past ${duration} days, ${priorUsers} of users, ${baselineRate}% conversion rate (n=${priorConversions})</li></ul>
<div><br></div>
<div><strong>Duration</strong></div>
<ul><li>Estimated ${duration} days, upon a/b test completion see Wrike fields "AB Test Launch Date" and "AB Test Conclude Date"</li></ul>
<div><br></div>
<div><strong>Minimum Detectable Effect (MDE)</strong></div>
<ul><li>Estimation from prior data ${splitText}, upon completion of a/b test, requires +${mdeRelative}% relative lift, new conversion rate must be at least ${targetRate}%, ${confidence}% confidence, ${power}% power</li></ul>`;
}

function calculateDuration(traffic, conversions, variants, desiredMDE, confidence, power, isTwoSided, trafficSplit = 50) {
    // 1. Baseline Rate (p)
    let p = conversions / traffic;
    if (p <= 0) p = 0.001;
    if (p >= 1) p = 0.999;

    // 2. Constants
    const z_alpha = getZScore(confidence, isTwoSided);
    const z_beta = getPowerScore(power);

    // 3. Target Rate with Desired MDE
    const mde_absolute = p * (desiredMDE / 100);
    const p_target = p + mde_absolute;

    if (p_target <= 0 || p_target >= 1) return 0;

    const term = Math.asin(Math.sqrt(p_target)) - Math.asin(Math.sqrt(p));

    // n_eff = ( (z_alpha + z_beta)^2 ) / (2 * term^2 )
    // For equal split, total traffic N = 2 * n_eff
    // For unequal split, 1/n1 + 1/n2 = 1/(0.5*N_eff) + 1/(0.5*N_eff) = 4/N_eff
    // In general, 1/n1 + 1/n2 = 1/(Nr) + 1/(N(1-r)) = 1 / (N * r * (1-r))
    // So 1/(N * r * (1-r)) = 4 / N_eff  => N = N_eff / (4 * r * (1-r))

    const n_eff = 0.5 * Math.pow((z_alpha + z_beta) / term, 2);
    const N_eff = 2 * n_eff;

    let totalTrafficRequired;
    if (variants === 2) {
        const r = trafficSplit / 100;
        totalTrafficRequired = N_eff / (4 * r * (1 - r));
    } else {
        totalTrafficRequired = n_eff * variants;
    }

    // 5. Days = Total Traffic / Daily Traffic
    const dailyTraffic = traffic / 7;
    const days = totalTrafficRequired / dailyTraffic;

    return Math.ceil(days);
}

function generateDurationOutput(traffic, conversions, variants, desiredMDE, days, confidence, power, trafficSplit) {
    const baselineRate = ((conversions / traffic) * 100).toFixed(2);
    let splitText = "";
    if (variants === 2) {
        splitText = ` with a ${100 - trafficSplit}/${trafficSplit} split`;
    }

    return `<div><strong>Prior Data</strong></div>
    <ul><li>Based on weekly traffic of ${traffic} and ${conversions} conversions (${baselineRate}% rate).</li></ul>
    <div><br></div>
    <div><strong>Estimated Duration</strong></div>
    <ul><li>To detect a <strong>${desiredMDE}% lift</strong> (MDE)${splitText} with ${confidence}% confidence and ${power}% power, you need to run the test for approximately <strong>${days} days</strong>.</li></ul>`;
}

// Post-Test Logic
document.addEventListener('DOMContentLoaded', () => {
    const calcPostBtn = document.getElementById('calculate-post-test-btn');
    const copyPostBtn = document.getElementById('copy-post-test-btn');
    const addMetricBtn = document.getElementById('add-metric-btn');
    const metricsContainer = document.getElementById('metrics-container');

    if (addMetricBtn) {
        addMetricBtn.addEventListener('click', () => {
            createMetricRow(metricsContainer);
            savePostTestInputs(); // Save after adding
        });
    }

    // Auto-Save Attachments
    const inputsToWatch = [
        'control-visitors', 'variant-visitors', 'post-test-confidence'
    ];
    inputsToWatch.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', savePostTestInputs);
            el.addEventListener('change', savePostTestInputs);
        }
    });

    const testTypeRadios = document.getElementsByName('test-type');
    testTypeRadios.forEach(r => r.addEventListener('change', savePostTestInputs));

    const clearPostBtn = document.getElementById('clear-post-test-btn');
    if (clearPostBtn) {
        clearPostBtn.addEventListener('click', clearPostTestInputs);
    }

    // Initial attachment to default row (if it persists and wasn't cleared by restore)
    // Note: restore logic runs async, so we might attach here and then restore wipes it. 
    // But restore is inside `chrome.storage.local.get` callback which runs after this sync code? 
    // Actually, persistence check is at top of file, this is further down.
    // We should rely on the restore logic to handle the initial state.

    if (calcPostBtn) {
        calcPostBtn.addEventListener('click', () => {
            const cVisitors = parseFloat(document.getElementById('control-visitors').value) || 0;
            const vVisitors = parseFloat(document.getElementById('variant-visitors').value) || 0;
            const confidence = parseInt(document.getElementById('post-test-confidence').value) || 90;

            // Get selected test type
            const testTypeInput = document.querySelector('input[name="test-type"]:checked');
            const isTwoSided = testTypeInput ? testTypeInput.value === 'two-sided' : false;

            if (cVisitors === 0 || vVisitors === 0) {
                alert('Please enter valid visitor counts.');
                return;
            }

            // Loop through metrics
            const metricRows = document.querySelectorAll('#metrics-container .metric-row');
            const results = [];

            let hasError = false;

            metricRows.forEach(row => {
                if (hasError) return;

                const name = row.querySelector('.metric-name').value || "Metric";
                const cConv = parseFloat(row.querySelector('.control-conv').value) || 0;
                const vConv = parseFloat(row.querySelector('.variant-conv').value) || 0;

                // Validation: Conversions > Visitors
                if (cConv > cVisitors) {
                    alert(`Error in "${name}": Control conversions (${cConv}) cannot exceed Control visitors (${cVisitors}).`);
                    hasError = true;
                    return;
                }
                if (vConv > vVisitors) {
                    alert(`Error in "${name}": Variant conversions (${vConv}) cannot exceed Variant visitors (${vVisitors}).`);
                    hasError = true;
                    return;
                }

                if (cConv > 0 || vConv > 0) {
                    const res = calculateSig(cVisitors, cConv, vVisitors, vConv, confidence, isTwoSided);
                    res.name = name;
                    res.convA = cConv;
                    res.convB = vConv;
                    results.push(res);
                }
            });

            if (hasError) return;

            if (results.length === 0) {
                alert("Please add at least one metric with data.");
                return;
            }

            const html = generatePostTestOutput(cVisitors, vVisitors, results, confidence, isTwoSided);

            document.getElementById('post-test-output').innerHTML = html;
            document.getElementById('post-test-result-area').classList.remove('hidden');
        });
    }

    if (copyPostBtn) {
        copyPostBtn.addEventListener('click', () => {
            copyToClipboard('post-test-output', copyPostBtn);
        });
    }
});

function createMetricRow(container, name = "Additional Metric", valA = "", valB = "") {
    const rowView = document.createElement('div');
    rowView.className = 'metric-row';
    // Only add remove button if it's not the very first primary row? 
    // Or just always add it. The Default static row usually is "Primary KPI".
    // Let's add it for consistency, but maybe style it differently if needed.
    // For now, simple implementation.

    // Check if it's the first row (Primary)
    const isFirst = container.children.length === 0;
    const defaultName = isFirst ? "Primary Metric" : "Additional Metric";
    const finalName = name === "Additional Metric" && isFirst ? defaultName : name;

    const removeBtnHtml = isFirst ? '' : '<button class="remove-metric-btn" title="Remove Metric">✕</button>';

    rowView.innerHTML = `
        ${removeBtnHtml}
        <div class="metric-header">
            <input type="text" class="metric-name" placeholder="Metric Name" value="${finalName}">
        </div>
        <div class="metric-inputs">
            <div class="form-group">
                <label>(A) Conversions</label>
                <input type="number" class="control-conv" placeholder="0" value="${valA}">
            </div>
            <div class="form-group">
                <label>(B) Conversions</label>
                <input type="number" class="variant-conv" placeholder="0" value="${valB}">
            </div>
        </div>
    `;

    if (!isFirst) {
        rowView.querySelector('.remove-metric-btn').addEventListener('click', () => {
            rowView.remove();
            savePostTestInputs();
        });
    }

    container.appendChild(rowView);
    attachAutoSaveToRow(rowView);
    return rowView;
}

function attachAutoSaveToRow(row) {
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', savePostTestInputs);
        input.addEventListener('change', savePostTestInputs);
    });
}

function savePostTestInputs() {
    const cVisitors = document.getElementById('control-visitors').value;
    const vVisitors = document.getElementById('variant-visitors').value;
    const confidence = document.getElementById('post-test-confidence').value;

    const testTypeInput = document.querySelector('input[name="test-type"]:checked');
    const testType = testTypeInput ? testTypeInput.value : 'one-sided';

    // Metrics
    const metrics = [];
    document.querySelectorAll('#metrics-container .metric-row').forEach(row => {
        const name = row.querySelector('.metric-name').value;
        const valA = row.querySelector('.control-conv').value;
        const valB = row.querySelector('.variant-conv').value;
        metrics.push({ name, valA, valB });
    });

    localStorage.setItem('postTestVisitors', JSON.stringify({ control: cVisitors, variant: vVisitors }));
    localStorage.setItem('postTestConfidence', confidence);
    localStorage.setItem('postTestType', testType);
    localStorage.setItem('postTestMetrics', JSON.stringify(metrics));
}

function clearPostTestInputs() {
    // Clear Inputs
    document.getElementById('control-visitors').value = '';
    document.getElementById('variant-visitors').value = '';
    document.getElementById('post-test-confidence').value = '95'; // Default

    // Reset Metrics
    const metricsContainer = document.getElementById('metrics-container');
    metricsContainer.innerHTML = '';
    createMetricRow(metricsContainer, "Primary Metric");

    // Hide Results
    document.getElementById('post-test-result-area').classList.add('hidden');
    document.getElementById('post-test-output').innerHTML = '';

    // Clear Storage
    localStorage.removeItem('postTestVisitors');
    localStorage.removeItem('postTestConfidence');
    localStorage.removeItem('postTestType');
    localStorage.removeItem('postTestMetrics');
}

function savePreTestInputs() {
    const traffic = document.getElementById('weekly-traffic').value;
    const conversions = document.getElementById('weekly-conversions').value;
    const variants = document.getElementById('variants').value;
    const duration = document.getElementById('duration').value;
    const desiredMDE = document.getElementById('desired-mde').value;
    const confidence = document.getElementById('confidence').value;
    const power = document.getElementById('power').value;
    const trafficSplit = document.getElementById('traffic-split').value;

    const testTypeInput = document.querySelector('input[name="pre-test-type"]:checked');
    const preTestType = testTypeInput ? testTypeInput.value : 'two-sided';

    // Check mode
    const activeModeBtn = document.querySelector('.segmented-btn.active');
    const currentMode = activeModeBtn ? activeModeBtn.dataset.mode : 'find-mde';

    localStorage.setItem('weeklyTraffic', traffic);
    localStorage.setItem('weeklyConversions', conversions);
    localStorage.setItem('variants', variants);
    localStorage.setItem('duration', duration);
    localStorage.setItem('desiredMDE', desiredMDE);
    localStorage.setItem('confidence', confidence);
    localStorage.setItem('power', power);
    localStorage.setItem('preTestType', preTestType);
    localStorage.setItem('preTestMode', currentMode);
    localStorage.setItem('trafficSplit', trafficSplit);
}

function clearPreTestInputs() {
    document.getElementById('weekly-traffic').value = '';
    document.getElementById('weekly-conversions').value = '';
    document.getElementById('variants').value = '2';
    document.getElementById('duration').value = '30';
    document.getElementById('desired-mde').value = '';
    document.getElementById('traffic-split').value = '50';

    // Clear results
    document.getElementById('result-area').classList.add('hidden');
    document.getElementById('output-text').innerHTML = '';

    // Clear Storage
    localStorage.removeItem('weeklyTraffic');
    localStorage.removeItem('weeklyConversions');
    localStorage.removeItem('variants');
    localStorage.removeItem('duration');
    localStorage.removeItem('desiredMDE');
    localStorage.removeItem('confidence');
    localStorage.removeItem('power');
    localStorage.removeItem('preTestType');
    localStorage.removeItem('preTestMode');
    localStorage.removeItem('trafficSplit');

    // Reset visibility
    updateTrafficSplitUI(2);
}

function copyToClipboard(elementId, btnElement) {
    const htmlContent = document.getElementById(elementId).innerHTML;
    const plainText = document.getElementById(elementId).innerText;

    try {
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([plainText], { type: 'text/plain' });
        const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
        navigator.clipboard.write(data).then(() => showFeedback(btnElement));
    } catch (e) {
        navigator.clipboard.writeText(plainText).then(() => showFeedback(btnElement));
    }
}

function showFeedback(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '<span style="font-size: 10px;">Copied!</span>';
    setTimeout(() => btn.innerHTML = original, 1500);
}

function calculateSig(cA, cConvA, cB, cConvB, confidenceTarget, isTwoSided = false) {
    const pA = cConvA / cA;
    const pB = cConvB / cB;
    const lift = ((pB - pA) / pA);

    // Z-Score Calculation (Two-tailed pooled for SE, but used for one/two sided P)
    const pPool = (cConvA + cConvB) / (cA + cB);
    const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / cA + 1 / cB));
    const z = (pB - pA) / sePool;

    // P-value
    let pValue;
    if (isTwoSided) {
        // Two-Sided: 2 * (1 - cdf(|z|))
        pValue = 2 * (1 - cdf(Math.abs(z)));
    } else {
        // One-Sided: 1 - cdf(z) (if testing B > A)
        // Note: If z is negative, 1-cdf(z) > 0.5. 
        // Standard tools show p-value for the observed direction or absolute? 
        // Usually p-value for H1 (Impv). If z < 0, p > 0.5 implies "Probability B is better" is low.
        // However, standard display often shows p-value for the tail in the direction of effect or just 1-cdf(|z|)
        // Let's stick to standard One-Sided: 1 - cdf(z)
        pValue = 1 - cdf(z);
    }

    const confidenceObserved = (1 - pValue) * 100;

    // Significance Threshold
    // For 95% conf: 
    // Two-Sided: p < 0.05
    // One-Sided: p < 0.05
    const alpha = 1 - (confidenceTarget / 100);
    const isSig = pValue < alpha;

    // Confidence Intervals
    // Usually displayed as Two-Sided standard error ranges regardless of test type
    // But critical Z changes if we strictly follow test type. 
    // Speero likely uses standard Two-Sided Z (1.96 for 95%) for the CI display.
    const zCrit = getZScore(confidenceTarget, true); // Always use Two-Sided Z for CI display standard

    const seA = Math.sqrt((pA * (1 - pA)) / cA);
    const seB = Math.sqrt((pB * (1 - pB)) / cB);

    const ciA_lower = Math.max(0, pA - zCrit * seA);
    const ciA_upper = Math.min(1, pA + zCrit * seA);
    const ciB_lower = Math.max(0, pB - zCrit * seB);
    const ciB_upper = Math.min(1, pB + zCrit * seB);

    return {
        lift: lift,
        zScore: z,
        pValue: pValue,
        confidenceObserved: confidenceObserved,
        isSignificant: isSig,
        rateA: pA,
        rateB: pB,
        ciA: [ciA_lower, ciA_upper],
        ciB: [ciB_lower, ciB_upper]
    };
}

function cdf(x) {
    // Error function approximation
    const t = 1 / (1 + .2316419 * Math.abs(x));
    const d = .3989423 * Math.exp(-x * x / 2);
    let p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) p = 1 - p;
    return p;
}

function generatePostTestOutput(cA, cB, results, targetConf, isTwoSided) {
    // Insights Summary
    const insightBullets = results.map(res => {
        const liftPerc = (res.lift * 100).toFixed(2);
        const pVal = res.pValue < 0.001 ? '< 0.001' : res.pValue.toFixed(2);
        const sign = res.lift > 0 ? '+' : '';
        const sigText = res.isSignificant ? 'statistically significant' : 'not statistically significant';
        const rateB = (res.rateB * 100).toFixed(2);

        // Format: [+/-#.#% change in primary success metric], [statistically significant or not] ([# primary success metric], [% primary success metric rate], p = [#])
        let msg = `<strong>${sign}${liftPerc}% change in ${res.name}</strong>, ${sigText} (${res.convB} ${res.name}, ${rateB}% rate, p = ${pVal})`;

        return `<li>${msg}</li>`;
    }).join('');

    // Action Logic
    let actionText = "";
    const primary = results[0];
    let hasGuardrailWarning = false;

    // Check Guardrails (Secondary Metrics)
    // We start from index 1 (Secondary metrics)
    for (let i = 1; i < results.length; i++) {
        if (results[i].isSignificant && results[i].lift < 0) {
            hasGuardrailWarning = true;
            break;
        }
    }

    if (primary.isSignificant) {
        if (primary.lift > 0) {
            // (A) Statistically significant positive change
            actionText = "<li>Recommend to implement <strong>Challenger experience</strong>.";
            if (hasGuardrailWarning) {
                actionText += " <br><span style='color: #ff4d4f;'><strong>Caution:</strong> One or more secondary metrics show a statistically significant negative impact. Review before implementing.</span>";
            }
            actionText += "</li>";
        } else {
            // (B) Statistically significant negative change
            actionText = "<li>Recommend to <strong>not implement Challenger experience</strong>.</li>";
        }
    } else {
        // (C) Not statistically significant
        actionText = "<li>Not required to implement <strong>Challenger experience</strong>.</li>";
    }

    // Row Generation
    const createMetricRowGroup = (res) => {
        const liftPerc = (res.lift * 100).toFixed(2);
        const liftClass = res.lift > 0 ? 'positive' : (res.lift < 0 ? 'negative' : 'neutral');
        const pValueStr = res.pValue < 0.001 ? 'p < 0.001' : `p = ${res.pValue.toFixed(3)}`;
        const fmtRate = (r) => (r * 100).toFixed(2) + '%';

        // CI Block styling
        const ciBlock = `
            <div style="font-size:10px; line-height:1.4; white-space:nowrap;">
                Control: ${(res.ciA[0] * 100).toFixed(1)}% - ${(res.ciA[1] * 100).toFixed(1)}%<br>
                Challenger: ${(res.ciB[0] * 100).toFixed(1)}% - ${(res.ciB[1] * 100).toFixed(1)}%
            </div>
        `;

        // Name cleaning for rows
        // If metric name is "Clicks on Secondary CTA", Row 1 is "# of Clicks...", Row 2 is "% of Clicks..."
        const baseName = res.name.replace(/^(# of |% of )/i, '');

        return `
            <tr>
                <td style="font-weight:600;"># ${baseName}</td>
                <td>${res.convA}</td>
                <td>${res.convB}</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td style="font-weight:600;">% ${baseName}</td>
                <td>${fmtRate(res.rateA)}</td>
                <td>${fmtRate(res.rateB)}</td>
                <td class="${liftClass}">${liftPerc}%</td>
                <td>${ciBlock}</td>
                <td>${pValueStr}</td>
            </tr>
        `;
    };

    const metricRowsHtml = results.map(createMetricRowGroup).join('');

    return `
    <div class="insight-box">
        <div><strong>Insight</strong></div>
        <ul>
            ${insightBullets}
        </ul>
    </div>
    <br>
    <div class="action-box">
        <div><strong>Action</strong></div>
        <ul>
            ${actionText}
        </ul>
    </div>
    <br>
    <div>
    <strong>Data</strong>
    <table class="result-table">
        <thead>
            <tr>
                <th></th>
                <th>(A) Control</th>
                <th>(B) Challenger</th>
                <th>% Change</th>
                <th>${targetConf}% Confidence Interval</th>
                <th>p-value</th> <!-- ${isTwoSided ? '2-sided' : '1-sided'} -->
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="font-weight:600;">Users</td>
                <td>${cA}</td>
                <td>${cB}</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            ${metricRowsHtml}
        </tbody>
    </table></div>`;
}
