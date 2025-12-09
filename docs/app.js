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
            renderTableBody();

        } catch (err) {
            console.error("Error loading the leaderboard:", err);
            errorDisplay.textContent = "Failed to load leaderboard data. Please try again later.";
            errorDisplay.style.display = "block";
        } finally {
            loadingIndicator.style.display = "none";
        }
    }
    
    function renderTableHeaders() {
        tableHead.innerHTML = ""; // Clear existing headers
        const headerRow = document.createElement("tr");

        // Standard headers
        headerRow.innerHTML = `
            <th>Rank</th>
            <th>Player</th>
        `;

        // Dynamic Challenge headers
        challengeDetails.forEach(challenge => {
            const th = document.createElement("th");
            th.classList.add("challenge-col");
            
            const link = document.createElement("a");
            link.href = `https://www.geoguessr.com/challenge/${challenge.id}`;
            link.textContent = challenge.name;
            link.target = "_blank"; // Open in new tab
            link.rel = "noopener noreferrer";
            
            th.appendChild(link);
            headerRow.appendChild(th);
        });

        // Remaining standard headers
        const remainingHeaders = `
            <th>Total Score</th>
            <th>Games Played</th>
            <th title="average_score * log(games_played + 1)">Weighted Score</th>
            <th>Wins</th>
            <th>Perfect Rounds</th>
        `;
        headerRow.innerHTML += remainingHeaders;
        tableHead.appendChild(headerRow);
    }

    function renderTableBody() {
        tableBody.innerHTML = ""; // Clear any existing rows

        leaderboardData.forEach(player => {
            const row = document.createElement("tr");

            // Standard cells
            let rowHtml = `
                <td>${player.rank}</td>
                <td>${escapeHtml(player.playerName)}</td>
            `;

            // Dynamic score cells
            challengeDetails.forEach(challenge => {
                const score = player.challengeScores[challenge.id] || 0;
                rowHtml += `<td class="challenge-col">${score.toLocaleString()}</td>`;
            });
            
            // Remaining standard cells
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
