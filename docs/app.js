// docs/app.js

document.addEventListener("DOMContentLoaded", () => {
    const table = document.getElementById("leaderboard-table");
    const tableHead = table.querySelector("thead");
    const tableBody = document.getElementById("leaderboard-body");
    const loadingIndicator = document.getElementById("loading");
    const errorDisplay = document.getElementById("error");
    const detailsToggle = document.getElementById("details-toggle");

    let leaderboardData = null;
    let challengeDetails = [];
    let currentSort = {
        column: 'weightedScore',
        direction: 'desc'
    };

    detailsToggle.addEventListener("change", () => {
        if (detailsToggle.checked) {
            table.classList.add("show-details");
        } else {
            table.classList.remove("show-details");
        }
    });

    async function loadLeaderboard() {
        try {
            const response = await fetch("data.json?v=" + new Date().getTime()); // Cache busting
            
            if (!response.ok) {
                throw new Error(`Could not fetch data.json. Status: ${response.status}`);
            }

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
            errorDisplay.style.display = "block";
        } finally {
            loadingIndicator.style.display = "none";
        }
    }

    function sortAndRender() {
        leaderboardData.sort((a, b) => {
            const key = currentSort.column;
            let valA = a[key];
            let valB = b[key];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) {
                return currentSort.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return currentSort.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Re-assign ranks after sorting
        leaderboardData.forEach((player, index) => {
            player.rank = index + 1;
        });

        renderTableBody();
        updateHeaderClasses();
    }
    
    function renderTableHeaders() {
        tableHead.innerHTML = ""; // Clear existing headers
        const headerRow = document.createElement("tr");

        const createHeader = (text, sortKey, isSortable = false, title = '') => {
            const th = document.createElement("th");
            th.textContent = text;
            if (title) {
                th.title = title;
            }
            if (isSortable) {
                th.classList.add('sortable');
                th.dataset.sortKey = sortKey;
                th.addEventListener('click', () => {
                    if (currentSort.column === sortKey) {
                        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        currentSort.column = sortKey;
                        currentSort.direction = 'desc'; // Default to descending for new column
                    }
                    sortAndRender();
                });
            }
            return th;
        };
        
        // --- Create and append headers ---
        headerRow.appendChild(createHeader('Rank', 'rank')); // Not sortable by rank
        headerRow.appendChild(createHeader('Player', 'playerName')); // Not sortable per user request

        // Dynamic Challenge headers (Links, not sortable)
        challengeDetails.forEach(challenge => {
            const th = document.createElement("th");
            th.classList.add("challenge-col");
            
            const link = document.createElement("a");
            link.href = `https://www.geoguessr.com/challenge/${challenge.id}`;
            link.textContent = challenge.name;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            
            th.appendChild(link);
            headerRow.appendChild(th);
        });
        
        // Remaining headers (some sortable)
        headerRow.appendChild(createHeader('Total Score', 'totalScore', true));
        headerRow.appendChild(createHeader('Games Played', 'gamesPlayed', true));
        headerRow.appendChild(createHeader('Weighted Score', 'weightedScore', true, 'normalized_average_per_round * log(games_played + 1)'));
        headerRow.appendChild(createHeader('Wins', 'challengesWon', true));
        headerRow.appendChild(createHeader('Perfect Rounds', 'perfectRounds', true));

        tableHead.appendChild(headerRow);
    }
    
    function updateHeaderClasses() {
        tableHead.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sortKey === currentSort.column) {
                th.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    function renderTableBody() {
        tableBody.innerHTML = ""; // Clear any existing rows

        leaderboardData.forEach(player => {
            const row = document.createElement("tr");

            let rowHtml = `
                <td>${player.rank}</td>
                <td>${escapeHtml(player.playerName)}</td>
            `;

            challengeDetails.forEach(challenge => {
                const score = player.challengeScores[challenge.id] || 0;
                rowHtml += `<td class="challenge-col">${score.toLocaleString()}</td>`;
            });
            
            rowHtml += `
                <td>${player.totalScore.toLocaleString()}</td>
                <td>${player.gamesPlayed}</td>
                <td>${player.weightedScore.toLocaleString()}</td>
                <td>${player.challengesWon}</td>
                <td>${player.perfectRounds}</td>
            `;

            row.innerHTML = rowHtml;
            tableBody.appendChild(row);
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    loadLeaderboard();
});
