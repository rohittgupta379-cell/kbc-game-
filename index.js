
        /***********************
         * CONFIG:   API  *
         ***********************/
        const  _API_KEY = "AIzaSyAQNy8KbWKV9_PsMIIS95LtJNAizvJ2B90"; // ← put your key here
        const  _MODEL = " -1.5-flash-latest"; // fast & cheap
        let askedQuestions = [];

        /***********************
         * Game State          *
         ***********************/
        const ladderData = [
            { q: 16, amt: "₹7,00,00,000" },
            { q: 15, amt: "₹1,00,00,000" },
            { q: 14, amt: "₹50,00,000" },
            { q: 13, amt: "₹25,00,000" },
            { q: 12, amt: "₹12,50,000" },
            { q: 11, amt: "₹6,40,000" },
            { q: 10, amt: "₹3,20,000", safe: true },
            { q: 9, amt: "₹1,60,000" },
            { q: 8, amt: "₹80,000" },
            { q: 7, amt: "₹40,000" },
            { q: 6, amt: "₹20,000" },
            { q: 5, amt: "₹10,000", safe: true },
            { q: 4, amt: "₹5,000" },
            { q: 3, amt: "₹3,000" },
            { q: 2, amt: "₹2,000" },
            { q: 1, amt: "₹1,000" }
        ];

        let currentLevel = 1;
        let lockedAnswer = null;
        let correctOption = null;
        let secondsLeft = 45;
        let timerId = null;
        let streak = 0; // consecutive correct
        let topicHint = "general knowledge";

        const elLadder = document.getElementById('ladder');
        const elQuestion = document.getElementById('question');
        const elAnswers = document.getElementById('answers');
        const elNext = document.getElementById('nextBtn');
        const elLevel = document.getElementById('levelPill');
        const elTimer = document.getElementById('timerPill');
        const elBanner = document.getElementById('banner');
        const elStreak = document.getElementById('streak');
        const elWinnings = document.getElementById('winnings');

        function renderLadder() {
            elLadder.innerHTML = '';
            ladderData.forEach(step => {
                const div = document.createElement('div');
                div.className = 'step' + (step.safe ? ' safe' : '') + (step.q === currentLevel ? ' active' : '');
                div.innerHTML = `<span>Q${step.q}</span><span class="amt">${step.amt}</span>`;
                elLadder.appendChild(div);
            })
        }

        function currentAmount() {
            const item = ladderData.find(x => x.q === currentLevel);
            return item ? item.amt : '₹0';
        }

        function safeFloorAmount() {
            if (currentLevel >= 10) return ladderData.find(x => x.q === 10).amt;
            if (currentLevel >= 5) return ladderData.find(x => x.q === 5).amt;
            return '₹0';
        }

        function startTimer() {
            clearInterval(timerId);
            secondsLeft = 45;
            elTimer.textContent = `⏱ ${secondsLeft}s`;
            timerId = setInterval(() => {
                secondsLeft--; elTimer.textContent = `⏱ ${secondsLeft}s`;
                if (secondsLeft <= 0) {
                    clearInterval(timerId);
                    lockAndReveal(null); // timeout = wrong
                }
            }, 1000);
        }

        // Fetch a MCQ from  ; ask for strict JSON
        async function fetchQuestionFrom (level, topic) {
            const difficulty = level <= 5 ? 'easy' : level <= 10 ? 'medium' : 'hard';

            const prompt = (
                `Create one Indian GK multiple-choice question in ${difficulty} difficulty, topic: ${topic}.\n` +
                `Do NOT repeat any of these questions: ${askedQuestions.map(q => `"${q}"`).join(", ")}.\n` +
                `Return STRICT JSON ONLY with keys: question (string), options (array of 4 strings labeled A-D implicitly), answer (index 0-3), explanation (string). No markdown.`
            );

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${ _MODEL}:generateContent?key=${ _API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.8, maxOutputTokens: 256 }
                    })
                }
            );

            if (!res.ok) throw new Error('  error');
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
            const q = JSON.parse(clean);

            // ✅ Avoid duplicates manually
            if (askedQuestions.includes(q.question)) {
                console.warn("Duplicate detected, regenerating...");
                return fetchQuestionFrom (level, topic);
            }

            // Store asked question
            askedQuestions.push(q.question);

            return q;
        }

        // Fallback questions when API fails
        const fallbackPool = [
            {
                question: 'Which river is known as the lifeline of India?',
                options: ['Ganga', 'Yamuna', 'Brahmaputra', 'Godavari'],
                answer: 0,
                explanation: 'The Ganga is often called India\'s lifeline due to its basin and cultural role.'
            },
            {
                question: 'Who was the first woman Prime Minister of India?',
                options: ['Sarojini Naidu', 'Indira Gandhi', 'Pratibha Patil', 'Sonia Gandhi'],
                answer: 1,
                explanation: 'Indira Gandhi served from 1966 to 1977 and again from 1980 to 1984.'
            },
            {
                question: 'The capital of Telangana is…',
                options: ['Vijayawada', 'Visakhapatnam', 'Hyderabad', 'Amaravati'],
                answer: 2,
                explanation: 'Hyderabad serves as the capital of Telangana.'
            }
        ];

        async function loadQuestion() {
            renderLadder();
            elLevel.textContent = `Q${currentLevel} · ${currentAmount()}`;
            elBanner.textContent = `Difficulty scales with level · Safe: ${safeFloorAmount()}`;

            elQuestion.textContent = 'Fetching question from  …';
            elAnswers.innerHTML = '';
            elNext.disabled = true; lockedAnswer = null; correctOption = null;

            let q;
            try { q = await fetchQuestionFrom (currentLevel, topicHint); }
            catch (e) { q = fallbackPool[Math.floor(Math.random() * fallbackPool.length)]; }

            elQuestion.textContent = q.question;
            correctOption = q.answer; // 0..3

            const letters = ['A', 'B', 'C', 'D'];
            q.options.forEach((opt, idx) => {
                const b = document.createElement('button');
                b.className = 'btn';
                b.innerHTML = `<strong>${letters[idx]}.</strong> ${opt}`;
                b.onclick = () => selectAnswer(idx, b);
                elAnswers.appendChild(b);
            });

            // store explanation for later banner
            elBanner.dataset.explanation = q.explanation || '';
            startTimer();
        }

        function selectAnswer(idx, btn) {
            [...elAnswers.children].forEach(b => b.classList.remove('correct', 'wrong'));
            lockedAnswer = idx; elNext.disabled = false;
            // visual soft selection
            [...elAnswers.children].forEach(b => b.style.outline = '');
            btn.style.outline = '2px solid var(--gold)';
        }

        function lockAndReveal(forceIdx) {
            clearInterval(timerId);
            const idx = forceIdx ?? lockedAnswer; // null means timeout
            const nodes = [...elAnswers.children];
            nodes.forEach((b, i) => {
                if (i === correctOption) b.classList.add('correct');
                if (i === idx && idx !== correctOption) b.classList.add('wrong');
                b.disabled = true;
                b.style.outline = '';
            });

            if (idx === correctOption) {
                streak++; elStreak.textContent = String(streak);
                elBanner.textContent = `Correct! ${elBanner.dataset.explanation || ''}`;
                // advance
                updateWinnings(currentLevel);
                currentLevel++;
                if (currentLevel > 16) {
                    elBanner.textCo
                    ntent = 'You\'ve conquered the full ladder! 🏆';
                    elNext.disabled = true; return;
                }
            } else {
                const sf = safeFloorAmount();
                elBanner.textContent = `Wrong! You take home ${sf}. ${elBanner.dataset.explanation || ''}`;
                streak = 0; elStreak.textContent = '0';
                // reset game
                currentLevel = 1;
            }

            elNext.disabled = false;  // becomes "Next"
            elNext.textContent = 'Next ▶';
        }

        function updateWinnings(level) {
            const amt = ladderData.find(x => x.q === level)?.amt || '₹0';
            elWinnings.textContent = amt;
        }

        // Lifelines
        document.querySelectorAll('.life button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.life;
                const box = btn.closest('.life');
                if (box.classList.contains('used')) return;
                if (!elAnswers.children.length) return;

                if (type === 'fifty') {
                    // hide two incorrect
                    const indices = [0, 1, 2, 3].filter(i => i !== correctOption);
                    shuffle(indices).slice(0, 2).forEach(i => elAnswers.children[i].style.visibility = 'hidden');
                }
                if (type === 'audience') {
                    // fake poll
                    const bars = [0, 0, 0, 0];
                    bars[correctOption] = 60 + Math.floor(Math.random() * 21); // 60-80
                    const rest = 100 - bars[correctOption];
                    const others = shuffle([0, 1, 2, 3].filter(i => i !== correctOption));
                    bars[others[0]] = Math.floor(rest * 0.6);
                    bars[others[1]] = Math.floor(rest * 0.3);
                    bars[others[2]] = rest - bars[others[0]] - bars[others[1]];
                    elBanner.textContent = `Audience Poll → A:${bars[0]}% B:${bars[1]}% C:${bars[2]}% D:${bars[3]}%`;
                }
                if (type === 'flip') {
                    lockAndReveal(correctOption); // treat as correct & advance
                }
                box.classList.add('used');
                btn.disabled = true;
            })
        })

        function shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] } return arr;
        }

        // Controls
        elNext.addEventListener('click', () => {
            if (lockedAnswer === null && elNext.textContent.startsWith('Lock')) {
                elBanner.textContent = 'Select an option first.'; return;
            }
            if (elNext.textContent.startsWith('Lock')) {
                lockAndReveal();
            } else {
                // reset for next question
                // document.getElementById('fiftyLife').classList.remove('used');
                // document.getElementById('audienceLife').classList.remove('used');
                // document.getElementById('flipLife').classList.remove('used');
                // document.querySelectorAll('.life button').forEach(b => b.disabled = false);
                elNext.textContent = 'Lock & Next ▶';
                loadQuestion();
            }
        });

        document.getElementById('newTopicBtn').addEventListener('click', async () => {
            const t = prompt('Enter a topic (e.g., history, science, sports):', topicHint) || topicHint;
            topicHint = t;
            elBanner.textContent = `Topic set to: ${topicHint}`;
            await new Promise(r => setTimeout(r, 400));
            loadQuestion();
        });

        // Init
        renderLadder();
        loadQuestion();
    