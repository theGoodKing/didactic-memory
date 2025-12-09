// docs/app.js

document.addEventListener("DOMContentLoaded", () => {
    // --- Constants ---
    const ICONS = {
        arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>`,
        arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>`,
        link: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`
    };

    // --- DOM Elements ---
    const table = document.getElementById("leaderboard-table");
    const tableHead = table.querySelector("thead");
    const tableBody = document.getElementById("leaderboard-body");
    const loadingIndicator = document.getElementById("loading");
    const errorDisplay = document.getElementById("error");
    const detailsToggle = document.getElementById("details-toggle");

    // --- State ---
    let leaderboardData = null;
    let challengeDetails = [];
    let currentSort = {
        column: 'weightedScore',
        direction: 'desc'
    };

    // --- Event Listeners ---
    detailsToggle.addEventListener("change", () => {
        if (detailsToggle.checked) {
            table.classList.add("show-details");
        } else {
            table.classList.remove("show-details");
        }
    });

    // --- Core Functions ---
    async function loadLeaderboard() {
        try {
            const response = await fetch("data.json?v=" + new Date().getTime());
            if (!response.ok) throw new Error(`Could not fetch data.json. Status: ${response.status}`);
            
            const data = await response.json();
            if (!data.leaderboard || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
                errorDisplay.textContent = "Leaderboard data is empty or invalid.";
                errorDisplay.style.display = "block";
                return;
            }

            leaderboardData = data.leaderboard;
            challengeDetails = data.challengeDetails || [];
            
            renderTableHeaders();
            sortAndRender(); // Initial sort and render
        } catch (err) {
            console.error("Error loading the leaderboard:", err);
            errorDisplay.textContent = "Failed to load leaderboard data. Please try again later.";
        } finally {
            loadingIndicator.style.display = "none";
        }
    }

    function sortAndRender() {
        leaderboardData.sort((a, b) => {
            const key = currentSort.column;
            let valA, valB;

            if (key.startsWith('challenge-')) {
                const challengeId = key.split('-')[1];
                valA = a.challengeScores[challengeId] || 0;
                valB = b.challengeScores[challengeId] || 0;
            } else {
                valA = a[key];
                valB = b[key];
            }

            if (typeof valA === 'string') {
                return (currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA));
            } else {
                if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            }
        });

        leaderboardData.forEach((player, index) => player.rank = index + 1);
        renderTableBody();
        updateHeaderClasses();
    }

    function renderTableHeaders() {
        tableHead.innerHTML = "";
        const headerRow = document.createElement("tr");

        const createHeader = (config) => {
            const th = document.createElement("th");
            const contentDiv = document.createElement("div");
            contentDiv.className = "header-content";

            const textSpan = document.createElement("span");
            textSpan.textContent = config.text;
            textSpan.title = config.text;
            contentDiv.appendChild(textSpan);

            const iconsDiv = document.createElement("div");
            iconsDiv.className = "header-icons";

            if (config.isChallenge) {
                th.classList.add("challenge-col");
                const link = document.createElement("a");
                link.href = `https://www.geoguessr.com/challenge/${config.challengeId}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "challenge-link-icon";
                link.innerHTML = ICONS.link;
                iconsDiv.appendChild(link);
            }

            if (config.isSortable) {
                th.classList.add('sortable');
                th.dataset.sortKey = config.sortKey;
                th.addEventListener('click', (e) => {
                    // Don't sort if the link icon was clicked
                    if (e.target.closest('.challenge-link-icon')) {
                        return;
                    }

                    if (currentSort.column === config.sortKey) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.column = config.sortKey;
                        currentSort.direction = 'desc';
                    }
                    sortAndRender();
                });
                
                const sortContainer = document.createElement("div");
                sortContainer.className = "sort-icon-container";
                iconsDiv.appendChild(sortContainer);
            }
            
            contentDiv.appendChild(iconsDiv);
            th.appendChild(contentDiv);
            return th;
        };
        
        headerRow.appendChild(createHeader({ text: 'Rank', sortKey: 'rank' }));
        headerRow.appendChild(createHeader({ text: 'Player', sortKey: 'playerName' }));

        challengeDetails.forEach(challenge => {
            headerRow.appendChild(createHeader({
                text: challenge.name,
                sortKey: `challenge-${challenge.id}`,
                isSortable: true,
                isChallenge: true,
                challengeId: challenge.id
            }));
        });
        
        headerRow.appendChild(createHeader({ text: 'Total Score', sortKey: 'totalScore', isSortable: true }));
        headerRow.appendChild(createHeader({ text: 'Games Played', sortKey: 'gamesPlayed', isSortable: true }));
        const weightedHeader = createHeader({ text: 'Weighted Score', sortKey: 'weightedScore', isSortable: true });
        weightedHeader.title = 'normalized_average_per_round * log(games_played + 1)';
        headerRow.appendChild(weightedHeader);
        headerRow.appendChild(createHeader({ text: 'Wins', sortKey: 'challengesWon', isSortable: true }));
        headerRow.appendChild(createHeader({ text: 'Perfect Rounds', sortKey: 'perfectRounds', isSortable: true }));

        tableHead.appendChild(headerRow);
    }
    
    function updateHeaderClasses() {
        tableHead.querySelectorAll('th.sortable').forEach(th => {
            const sortContainer = th.querySelector('.sort-icon-container');
            if (!sortContainer) return;

            sortContainer.innerHTML = ''; // Clear previous icon
            th.classList.remove('sorted-asc', 'sorted-desc');

            if (th.dataset.sortKey === currentSort.column) {
                th.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
                sortContainer.innerHTML = currentSort.direction === 'asc' ? ICONS.arrowUp : ICONS.arrowDown;
            }
        });
    }

    function renderTableBody() {
        tableBody.innerHTML = "";
        leaderboardData.forEach(player => {
            const row = document.createElement("tr");
            let rowHtml = `<td>${player.rank}</td><td>${escapeHtml(player.playerName)}</td>`;
            challengeDetails.forEach(challenge => {
                rowHtml += `<td class="challenge-col">${(player.challengeScores[challenge.id] || 0).toLocaleString()}</td>`;
            });
            rowHtml += `
                <td>${player.totalScore.toLocaleString()}</td>
                <td>${player.gamesPlayed}</td>
                <td>${player.weightedScore.toLocaleString()}</td>
                <td>${player.challengesWon}</td>
                <td>${player.perfectRounds.toLocaleString()}</td>
            `;
            row.innerHTML = rowHtml;
            tableBody.appendChild(row);
        });
    }

    function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    loadLeaderboard();
});
