/**
 * Integra AI - Script Universal de Auto-completare
 * 
 * Adaugă acest script în orice pagină HTML pentru a activa
 * completarea automată a câmpurilor din chatbot.
 * 
 * Folosire:
 * <script src="integra-autofill.js"></script>
 */

(function() {
    'use strict';

    // Configurare
    const CONFIG = {
        debug: true, // Activează logging-ul pentru debugging
        highlightFields: true, // Evidențiază câmpurile completate
        showNotifications: true, // Arată notificări când se completează câmpuri
    };

    /**
     * Detectează toate câmpurile de formular din pagină
     */
    function detectFormFields() {
        const fields = [];
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            // Ignoră câmpurile ascunse, butoane, și câmpuri disabled
            if (input.type === 'hidden' || 
                input.type === 'submit' || 
                input.type === 'button' ||
                input.type === 'reset' ||
                input.disabled) {
                return;
            }

            const label = findLabel(input);
            const fieldInfo = {
                element: input,
                id: input.id,
                name: input.name,
                type: input.type || 'text',
                placeholder: input.placeholder,
                label: label,
                possibleKeys: getPossibleKeys(input),
                // Informații suplimentare pentru LLM
                required: input.required || input.hasAttribute('required'),
                options: getFieldOptions(input),
                pattern: input.pattern,
                min: input.min,
                max: input.max,
                step: input.step
            };

            fields.push(fieldInfo);
        });

        return fields;
    }

    /**
     * Extrage opțiunile pentru câmpuri SELECT sau tipuri speciale
     */
    function getFieldOptions(input) {
        const options = [];
        
        if (input.tagName === 'SELECT') {
            Array.from(input.options).forEach(option => {
                if (option.value && !option.disabled) {
                    options.push({
                        value: option.value,
                        text: option.text.trim()
                    });
                }
            });
        } else if (input.type === 'radio' || input.type === 'checkbox') {
            // Pentru radio/checkbox, găsește toate opțiunile cu același name
            const name = input.name;
            if (name) {
                document.querySelectorAll(`input[type="${input.type}"][name="${name}"]`).forEach(radio => {
                    const label = findLabel(radio);
                    if (radio.value) {
                        options.push({
                            value: radio.value,
                            text: label || radio.value
                        });
                    }
                });
            }
        }
        
        return options;
    }

    /**
     * Găsește label-ul asociat cu un input
     */
    function findLabel(input) {
        // Încearcă să găsească label prin atributul "for"
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent.trim();
        }

        // Încearcă să găsească label părinte
        const parentLabel = input.closest('label');
        if (parentLabel) {
            return parentLabel.textContent.replace(input.value, '').trim();
        }

        // Încearcă să găsească label în apropiere
        const previousElement = input.previousElementSibling;
        if (previousElement && previousElement.tagName === 'LABEL') {
            return previousElement.textContent.trim();
        }

        return null;
    }

    /**
     * Generează posibile chei pentru un câmp bazat pe id, name, label, placeholder
     */
    function getPossibleKeys(input) {
        const keys = new Set();
        
        // Normalizează și adaugă id
        if (input.id) {
            keys.add(normalizeKey(input.id));
        }
        
        // Normalizează și adaugă name
        if (input.name) {
            keys.add(normalizeKey(input.name));
        }
        
        // Normalizează și adaugă label
        const label = findLabel(input);
        if (label) {
            keys.add(normalizeKey(label));
        }
        
        // Normalizează și adaugă placeholder
        if (input.placeholder) {
            keys.add(normalizeKey(input.placeholder));
        }

        // Adaugă variante comune în funcție de tip
        const commonMappings = {
            email: ['email', 'e-mail', 'mail', 'adresa_email'],
            tel: ['telefon', 'phone', 'tel', 'numar'],
            date: ['data', 'date', 'zi'],
            url: ['website', 'site', 'link', 'url'],
        };

        if (input.type in commonMappings) {
            commonMappings[input.type].forEach(k => keys.add(k));
        }

        return Array.from(keys);
    }

    /**
     * Normalizează o cheie (elimină spații, caractere speciale, lowercase)
     */
    function normalizeKey(key) {
        return key
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Elimină diacritice
            .replace(/[^a-z0-9]/g, '_') // Înlocuiește caractere speciale cu _
            .replace(/_+/g, '_') // Elimină _ duplicate
            .replace(/^_|_$/g, ''); // Elimină _ de la început și sfârșit
    }

    /**
     * Găsește cel mai bun câmp pentru o cheie din date
     */
    function findBestMatch(dataKey, fields) {
        const normalizedDataKey = normalizeKey(dataKey);
        
        // Căutare exactă
        for (const field of fields) {
            if (field.possibleKeys.includes(normalizedDataKey)) {
                return field;
            }
        }

        // Căutare parțială (substring)
        for (const field of fields) {
            for (const possibleKey of field.possibleKeys) {
                if (possibleKey.includes(normalizedDataKey) || 
                    normalizedDataKey.includes(possibleKey)) {
                    return field;
                }
            }
        }

        return null;
    }

    /**
     * Completează un câmp cu o valoare
     */
    function fillField(field, value) {
        const element = field.element;
        
        // Setează valoarea în funcție de tipul câmpului
        if (element.tagName === 'SELECT') {
            // Pentru select, caută opțiunea care se potrivește
            const normalizedValue = normalizeKey(String(value));
            let found = false;
            
            for (const option of element.options) {
                const normalizedOption = normalizeKey(option.value || option.text);
                if (normalizedOption === normalizedValue || 
                    normalizedOption.includes(normalizedValue) ||
                    normalizedValue.includes(normalizedOption)) {
                    element.value = option.value;
                    found = true;
                    break;
                }
            }
            
            // Dacă nu s-a găsit potrivire exactă, încearcă să seteze direct valoarea
            if (!found && element.querySelector(`option[value="${value}"]`)) {
                element.value = value;
            }
        } else if (element.type === 'checkbox') {
            // Pentru checkbox, setează checked bazat pe valoare
            const boolValue = value === true || value === 'true' || value === '1' || 
                             String(value).toLowerCase() === 'da' || 
                             String(value).toLowerCase() === 'yes';
            element.checked = boolValue;
        } else if (element.type === 'radio') {
            // Pentru radio, găsește butonul cu valoarea corespunzătoare
            const name = element.name;
            if (name) {
                const radio = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
                if (radio) {
                    radio.checked = true;
                }
            }
        } else if (element.type === 'date' || element.type === 'datetime-local') {
            // Pentru date, formatează valoarea corect
            if (value instanceof Date) {
                element.value = value.toISOString().split('T')[0];
            } else {
                element.value = value;
            }
        } else {
            element.value = value;
        }

        // Trigger events pentru framework-uri reactive
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Evidențiază câmpul
        if (CONFIG.highlightFields) {
            highlightField(element);
        }

        if (CONFIG.debug) {
            console.log(`✅ Câmp completat: ${field.label || field.id || field.name} = ${value}`);
        }
    }

    /**
     * Evidențiază un câmp completat
     */
    function highlightField(element) {
        const originalBorder = element.style.border;
        const originalBackground = element.style.background;
        
        element.style.border = '2px solid #10b981';
        element.style.background = '#d1fae5';
        
        setTimeout(() => {
            element.style.border = originalBorder;
            element.style.background = originalBackground;
        }, 2000);
    }

    /**
     * Procesează datele primite și completează câmpurile
     */
    function processAutoFillData(data) {
        if (!data || typeof data !== 'object') {
            console.warn('Date invalide pentru auto-completare:', data);
            return;
        }

        const fields = detectFormFields();
        let filledCount = 0;

        if (CONFIG.debug) {
            console.log('🔍 Câmpuri detectate:', fields.length);
            console.log('📦 Date primite:', data);
        }

        // Încearcă să completeze fiecare cheie din date
        for (const [key, value] of Object.entries(data)) {
            if (!value) continue;

            const matchedField = findBestMatch(key, fields);
            if (matchedField) {
                fillField(matchedField, value);
                filledCount++;
            } else if (CONFIG.debug) {
                console.warn(`⚠️ Nu s-a găsit câmp pentru: ${key}`);
            }
        }

        // Arată notificare
        if (CONFIG.showNotifications && filledCount > 0) {
            showNotification(`✅ ${filledCount} câmp${filledCount > 1 ? 'uri' : ''} completat${filledCount > 1 ? 'e' : ''} automat!`);
        }

        return filledCount;
    }

    /**
     * Arată o notificare temporară
     */
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        // Adaugă animație CSS
        if (!document.getElementById('integra-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'integra-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Cache pentru context (evită retrimiterea dacă nu s-a schimbat nimic)
    let lastContextHash = null;
    let contextCache = null;

    /**
     * Trimite informații despre câmpurile disponibile către iframe
     * OPTIMIZAT: Limitează dimensiunea contextului pentru requesturi mai rapide
     * OPTIMIZAT: Cache pentru a evita retrimiterea dacă nu s-a schimbat nimic
     */
    function sendPageContext() {
        const fields = detectFormFields();
        
        // Calculează hash pentru context (verifică dacă s-a schimbat ceva)
        const contextHash = JSON.stringify({
            count: fields.length,
            names: fields.map(f => f.label || f.id || f.name).slice(0, 10)
        });
        
        // Dacă contextul nu s-a schimbat, nu retrimite
        if (contextHash === lastContextHash && contextCache) {
            if (CONFIG.debug) {
                console.log('⏭️ Context neschimbat, folosim cache');
            }
            // Retrimite doar dacă iframe-ul cere explicit
            return;
        }
        
        lastContextHash = contextHash;
        
        // Construiește context optimizat pentru LLM (limitează opțiunile pentru viteză)
        const fieldsInfo = fields.map(f => {
            const fieldName = f.label || f.id || f.name || 'câmp_necunoscut';
            const info = {
                name: fieldName,
                type: f.type,
                required: f.required || false
            };
            
            // Adaugă placeholder doar dacă există (nu null)
            if (f.placeholder) {
                info.placeholder = f.placeholder;
            }
            
            // Limitează opțiunile la maxim 3 pentru SELECT/radio (optimizare viteză maximă)
            if (f.options && f.options.length > 0) {
                const limitedOptions = f.options.slice(0, 3).map(opt => opt.text || opt.value);
                // Dacă sunt mai multe opțiuni, adaugă indicator
                if (f.options.length > 3) {
                    limitedOptions.push(`... și ${f.options.length - 3} altele`);
                }
                info.options = limitedOptions;
            }
            
            // Adaugă constrângeri doar dacă sunt relevante (nu toate)
            if (f.pattern && f.pattern.length < 50) { // Limitează pattern-uri lungi
                info.pattern = f.pattern;
            }
            // Nu trimitem min/max pentru a reduce dimensiunea
            
            return info;
        });
        
        // Construiește context compact (limitează pentru viteză maximă)
        const context = {
            has_form: fields.length > 0,
            form_fields: fields.map(f => f.label || f.id || f.name).filter(Boolean).slice(0, 20), // Limitează la 20 câmpuri pentru viteză maximă
            fields_detailed: fieldsInfo.slice(0, 20), // Limitează la 20 câmpuri detaliate pentru viteză maximă
            page_title: document.title.length > 50 ? document.title.substring(0, 50) : document.title // Limitează titlul la 50 caractere
        };
        
        // Salvează în cache
        contextCache = context;

        // Trimite context către toate iframe-urile
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'pageContext',
                    payload: context
                }, '*');
            } catch (e) {
                // Ignoră erorile cross-origin
            }
        });

        if (CONFIG.debug) {
            console.log('📤 Context trimis către chat:', context);
        }
    }

    /**
     * Răspunde la cereri de context din iframe
     * OPTIMIZAT: Retrimite doar dacă este necesar
     */
    function handleContextRequest() {
        // Forțează retrimiterea chiar dacă există cache (iframe-ul cere explicit)
        const fields = detectFormFields();
        const contextHash = JSON.stringify({
            count: fields.length,
            names: fields.map(f => f.label || f.id || f.name).slice(0, 10)
        });
        lastContextHash = null; // Reset hash pentru a forța retrimiterea
        sendPageContext();
    }

    /**
     * Inițializare
     */
    function init() {
        // Ascultă mesaje de la chat iframe
        window.addEventListener('message', (event) => {
            if (!event.data || !event.data.type) return;

            if (event.data.type === 'autoFillFields') {
                if (CONFIG.debug) {
                    console.log('📨 Mesaj primit pentru auto-completare:', event.data.payload);
                }
                processAutoFillData(event.data.payload);
            } else if (event.data.type === 'requestPageContext') {
                // Răspunde la cererea de context din chat
                if (CONFIG.debug) {
                    console.log('📥 Cerere de context primită, trimit context...');
                }
                handleContextRequest();
            }
        });

        // Trimite context la încărcare și când se schimbă DOM-ul
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', sendPageContext);
        } else {
            sendPageContext();
        }

        // Re-trimite context când se adaugă iframe-uri noi
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    const hasIframe = Array.from(mutation.addedNodes).some(
                        node => node.tagName === 'IFRAME'
                    );
                    if (hasIframe) {
                        setTimeout(sendPageContext, 500);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('🤖 Integra AI Auto-Fill activat!');
    }

    // Pornește scriptul
    init();

    // Exportă funcții pentru debugging
    window.IntegraAutoFill = {
        detectFields: detectFormFields,
        fillData: processAutoFillData,
        sendContext: sendPageContext,
        config: CONFIG
    };

})();