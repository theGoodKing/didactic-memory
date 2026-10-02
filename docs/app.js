// docs/app.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Constants ---
  const ICONS = {
    arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>`,
    arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>`,
  };

  const COLUMNS = {
    standings: [
      { key: "position", label: "Pos" },
      { key: "name", label: "Name" },
      { key: "wins", label: "Wins" },
      { key: "podiums", label: "Podiums" },
      { key: "points", label: "Points" },
    ],
    week: [
      { key: "position", label: "Pos" },
      { key: "name", label: "Name" },
      { key: "sprintPoints", label: "Sprint Pts" },
      { key: "sprintBonus", label: "Sprint Bonus" },
      { key: "gpPoints", label: "GP Pts" },
      { key: "gpBonus", label: "GP Bonus" },
      { key: "total", label: "Total" },
    ],
  };
  const STATUS_LABELS = {
    upcoming: "Upcoming",
    active: "Provisional",
    final: "Final",
  };

  // --- DOM Elements ---
  const tabs = document.getElementById("tabs");
  const view = document.getElementById("view");
  const viewTitle = document.getElementById("view-title");
  const viewMeta = document.getElementById("view-meta");
  const table = document.getElementById("results-table");
  const tableHead = table.querySelector("thead");
  const tableBody = table.querySelector("tbody");
  const emptyMessage = document.getElementById("empty");
  const updated = document.getElementById("updated");
  const loadingIndicator = document.getElementById("loading");
  const errorDisplay = document.getElementById("error");

  // --- State ---
  let data = null;
  let currentWeek = null;
  let currentSlug = null;
  let currentSort = { column: "position", direction: "asc" };

  async function load() {
    try {
      const response = await fetch("data.json?v=" + Date.now());
      if (!response.ok)
        throw new Error(
          `Could not fetch data.json. Status: ${response.status}`,
        );
      data = await response.json();
      updated.textContent = data.generatedAt
        ? `Last updated ${formatDate(data.generatedAt)}`
        : "";
      renderTabs();
      window.addEventListener("hashchange", route);
      route();
      view.hidden = false;
    } catch (err) {
      console.error("Error loading data:", err);
      errorDisplay.textContent =
        "Failed to load results. Please try again later.";
      errorDisplay.hidden = false;
    } finally {
      loadingIndicator.hidden = true;
    }
  }

  function renderTabs() {
    const standingsTab = makeTab("standings", "Standings");
    standingsTab.classList.add("tab-pinned");
    tabs.replaceChildren(standingsTab);
    [...data.weeks]
      .sort((a, b) => a.week - b.week)
      .forEach((week) => {
        const tab = makeTab(week.slug, `W${week.week}: ${week.name}`);
        tab.classList.add(`status-${week.status}`);
        tabs.appendChild(tab);
      });
  }

  function makeTab(slug, label) {
    const a = document.createElement("a");
    a.href = `#${slug}`;
    a.dataset.slug = slug;
    a.textContent = label;
    return a;
  }

  function route() {
    const slug = decodeURIComponent(location.hash.slice(1)) || "standings";
    currentWeek = data.weeks.find((w) => w.slug === slug) || null;
    const resolved = currentWeek ? slug : "standings";
    if (resolved !== currentSlug) {
      currentSlug = resolved;
      currentSort = { column: "position", direction: "asc" };
    }
    tabs.querySelectorAll("a").forEach((a) => {
      const active = a.dataset.slug === resolved;
      a.classList.toggle("active", active);
      if (active) {
        a.setAttribute("aria-current", "page");
        if (!a.classList.contains("tab-pinned")) {
          a.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      } else {
        a.removeAttribute("aria-current");
      }
    });
    renderMeta();
    renderHeaders();
    renderBody();
  }

  function columns() {
    return currentWeek ? COLUMNS.week : COLUMNS.standings;
  }

  function rows() {
    const source = currentWeek ? currentWeek.results : data.standings;
    return source.map((row, i) => ({ ...row, position: i + 1 }));
  }

  function renderMeta() {
    viewMeta.replaceChildren();
    if (!currentWeek) {
      viewTitle.textContent = "Drivers' Championship";
      return;
    }
    viewTitle.textContent = `Week ${currentWeek.week}: ${currentWeek.name}`;

    const badge = document.createElement("span");
    badge.className = `badge status-${currentWeek.status}`;
    badge.textContent = STATUS_LABELS[currentWeek.status] || currentWeek.status;
    viewMeta.appendChild(badge);

    const when = document.createElement("span");
    when.textContent =
      currentWeek.status === "upcoming"
        ? `Opens ${formatDate(currentWeek.start)}`
        : `Closes ${formatDate(currentWeek.cutoff)}`;
    viewMeta.appendChild(when);

    [
      ["sprint", "Sprint"],
      ["gp", "Grand Prix"],
    ].forEach(([kind, label]) => {
      const challenge = currentWeek.challenges[kind];
      if (!challenge || currentWeek.status === "upcoming") return;
      const link = document.createElement("a");
      link.href = challenge.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "challenge-link";
      link.innerHTML = ICONS.link;
      link.append(` ${label} (${challenge.participants})`);
      viewMeta.appendChild(link);
    });
  }

  function renderHeaders() {
    const headerRow = document.createElement("tr");
    columns().forEach((col) => {
      const th = document.createElement("th");
      th.className = "sortable";
      th.dataset.sortKey = col.key;
      const content = document.createElement("div");
      content.className = "header-content";
      const text = document.createElement("span");
      text.textContent = col.label;
      const icon = document.createElement("span");
      icon.className = "sort-icon-container";
      content.append(text, icon);
      th.appendChild(content);
      th.addEventListener("click", () => {
        if (currentSort.column === col.key) {
          currentSort.direction =
            currentSort.direction === "asc" ? "desc" : "asc";
        } else {
          currentSort = {
            column: col.key,
            direction: ["position", "name"].includes(col.key) ? "asc" : "desc",
          };
        }
        renderBody();
      });
      headerRow.appendChild(th);
    });
    tableHead.replaceChildren(headerRow);
  }

  function renderBody() {
    const { column, direction } = currentSort;
    const sorted = rows().sort((a, b) => {
      const valA = a[column],
        valB = b[column];
      const cmp =
        typeof valA === "string" ? valA.localeCompare(valB) : valA - valB;
      return direction === "asc" ? cmp : -cmp;
    });

    tableBody.replaceChildren(
      ...sorted.map((row) => {
        const tr = document.createElement("tr");
        if (row.position <= 3) tr.classList.add(`p${row.position}`);
        columns().forEach((col) => {
          const td = document.createElement("td");
          td.textContent = row[col.key] ?? "";
          tr.appendChild(td);
        });
        return tr;
      }),
    );

    table.hidden = sorted.length === 0;
    emptyMessage.hidden = sorted.length > 0;
    emptyMessage.textContent =
      currentWeek?.status === "upcoming"
        ? "This week hasn't started yet."
        : "No results yet.";

    tableHead.querySelectorAll("th").forEach((th) => {
      const isSorted = th.dataset.sortKey === column;
      th.classList.toggle("sorted-asc", isSorted && direction === "asc");
      th.classList.toggle("sorted-desc", isSorted && direction === "desc");
      th.querySelector(".sort-icon-container").innerHTML = isSorted
        ? direction === "asc"
          ? ICONS.arrowUp
          : ICONS.arrowDown
        : "";
    });
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: data?.timezone || "Europe/London",
      timeZoneName: "short",
    });
  }

  load();
});
