// docs/app.js

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("leaderboard-body");
    const loadingIndicator = document.getElementById("loading");
    const errorDisplay = document.getElementById("error");

    async function loadLeaderboard() {
        try {
            // In a real scenario, the data.json file would be at the root of the GitHub Pages site.
            // For local testing, it's in the same directory.
            const response = await fetch("data.json");
            
            if (!response.ok) {
                throw new Error(`Could not fetch data.json. Status: ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                errorDisplay.textContent = "Leaderboard data is empty or invalid.";
                errorDisplay.style.display = "block";
                return;
            }

            // Clear any existing rows
            tableBody.innerHTML = "";

            // Populate the table
            data.forEach(player => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${player.rank}</td>
                    <td>${escapeHtml(player.playerName)}</td>
                    <td>${player.totalScore.toLocaleString()}</td>
                    <td>${player.gamesPlayed}</td>
                    <td>${player.averageScore.toLocaleString()}</td>
                    <td>${player.challengesWon}</td>
                    <td>${player.perfectRounds}</td>
                `;
                tableBody.appendChild(row);
            });

        } catch (err) {
            console.error("Error loading the leaderboard:", err);
            errorDisplay.textContent = "Failed to load leaderboard data. Please try again later.";
            errorDisplay.style.display = "block";
        } finally {
            loadingIndicator.style.display = "none";
        }
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
