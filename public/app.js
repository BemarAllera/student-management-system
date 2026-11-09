
/* =====================================================
   STUDENTHUB - STUDENT MANAGEMENT SYSTEM
   Complete Frontend JavaScript
   Connected to Express.js + SQLite
===================================================== */

const API = "/api/students";

let students = [];
let editingStudentId = null;
let currentPage = 1;
let pageSize = 5;
let sortField = "id";
let sortDirection = "desc";
let toastTimer = null;

// =====================================================
// DOM ELEMENT HELPER
// =====================================================

const getElement = id => document.getElementById(id);

const tableBody = getElement("studentTable");
const searchInput = getElement("searchStudents");
const studentForm = getElement("studentForm");
const saveButton = getElement("saveStudentBtn");

// =====================================================
// SECURITY
// =====================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// =====================================================
// NOTIFICATIONS
// =====================================================

function showNotification(message, type = "success") {
    let toast = getElement("systemToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "systemToast";
        toast.className = "system-toast";
        document.body.appendChild(toast);
    }

    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = `system-toast ${type} show`;

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// =====================================================
// API CONNECTION
// =====================================================

async function request(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
    } catch (error) {
        throw new Error(
            "Cannot connect to the server. Please run node server.js."
        );
    }

    const responseText = await response.text();

    let data;

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Invalid server response.");
    }

    if (!response.ok) {
        throw new Error(
            data.error || data.message || "Something went wrong."
        );
    }

    return data;
}

// =====================================================
// INITIALIZE DASHBOARD AND STUDENT RECORDS
// =====================================================

function initializeDashboard() {
    const table = tableBody?.closest("table");

    if (!table) {
        console.error("Student table not found.");
        return;
    }

    const wrapper = table.parentElement;
    const recordsSection = wrapper.parentElement;

    // STUDENT RECORDS TOOLBAR

    const toolbar = document.createElement("div");
    toolbar.className = "student-toolbar";

    toolbar.innerHTML = `
        <div class="toolbar-group">

            <select id="courseFilter">
                <option value="">All Courses</option>
            </select>

            <select id="yearFilter">
                <option value="">All Year Levels</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
            </select>

            <select id="sortFilter">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="nameAsc">Name A-Z</option>
                <option value="nameDesc">Name Z-A</option>
                <option value="course">Course A-Z</option>
            </select>

            <select id="pageSize">
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="1">1 per page</option>
            </select>

        </div>

        <div class="toolbar-group">
            <button type="button" id="refreshStudents">
                ↻ Refresh
            </button>

            <button type="button" id="exportStudents">
                ↓ Export CSV
            </button>

            <button type="button" id="printStudents">
                Print Records
            </button>
        </div>
    `;

    recordsSection.insertBefore(toolbar, wrapper);

    // PAGINATION CONTAINER

    const pagination = document.createElement("div");
    pagination.id = "studentPagination";
    pagination.className = "student-pagination";

    wrapper.insertAdjacentElement("afterend", pagination);

    // DASHBOARD STATISTICS

    const dashboardStats = document.querySelector(".stats");

    if (dashboardStats && !getElement("dashboardCourses")) {
        dashboardStats.insertAdjacentHTML("beforeend", `

            <div class="stat-card">
                <h3>Different Courses</h3>
                <p id="dashboardCourses">0</p>
            </div>

            <div class="stat-card">
                <h3>1st Year Students</h3>
                <p id="dashboardFirstYear">0</p>
            </div>

            <div class="stat-card">
                <h3>2nd Year Students</h3>
                <p id="dashboardSecondYear">0</p>
            </div>

            <div class="stat-card">
                <h3>3rd Year Students</h3>
                <p id="dashboardThirdYear">0</p>
            </div>

            <div class="stat-card">
                <h3>4th Year Students</h3>
                <p id="dashboardFourthYear">0</p>
            </div>

            <div class="stat-card">
                <h3>5th Year Students</h3>
                <p id="dashboardFifthYear">0</p>
            </div>

        `);
    }

    // TOOLBAR EVENTS

    getElement("courseFilter").addEventListener(
        "change", resetAndRender
    );

    getElement("yearFilter").addEventListener(
        "change", resetAndRender
    );

    getElement("sortFilter").addEventListener("change", function () {
        const sorting = {
            newest: ["id", "desc"],
            oldest: ["id", "asc"],
            nameAsc: ["name", "asc"],
            nameDesc: ["name", "desc"],
            course: ["course", "asc"]
        };

        [sortField, sortDirection] =
            sorting[this.value] || ["id", "desc"];

        currentPage = 1;
        displayStudents();
    });

    getElement("pageSize").addEventListener("change", function () {
        pageSize = Number(this.value) || 5;
        currentPage = 1;
        displayStudents();
    });

    getElement("refreshStudents").addEventListener(
        "click", loadStudents
    );

    getElement("exportStudents").addEventListener(
        "click", exportCSV
    );

    getElement("printStudents").addEventListener(
        "click", printRecords
    );
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(page) {
    const header = getElement("dashboard");
    const stats = document.querySelector(".stats");
    const records = getElement("students");
    const analytics = getElement("analytics");
    const form = getElement("studentFormSection");

    if (header) {
        header.classList.toggle("page-hidden", page !== "dashboard");
    }

    if (stats) {
        stats.classList.toggle("page-hidden", page !== "dashboard");
    }

    if (records) {
        records.classList.toggle("page-hidden", page !== "students");
    }

    if (analytics) {
        analytics.classList.toggle("page-hidden", page !== "analytics");
    }

    if (form) {
        form.classList.toggle("page-hidden", page !== "form");
        form.classList.toggle("hidden", page !== "form");
    }

    document.querySelectorAll(".sidebar nav a").forEach(link => {
        const target = link.getAttribute("href").replace("#", "");
        link.classList.toggle("active", target === page);
    });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function initializeNavigation() {
    document.querySelectorAll(".sidebar nav a").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            const page = link.getAttribute("href").replace("#", "");

            if (["dashboard", "students", "analytics"].includes(page)) {
                history.replaceState(null, "", `#${page}`);
                showPage(page);
            }
        });
    });

    const initialPage = location.hash.replace("#", "");

    showPage(
        ["dashboard", "students", "analytics"].includes(initialPage)
            ? initialPage
            : "dashboard"
    );
}

// =====================================================
// LOAD STUDENTS FROM DATABASE
// =====================================================

async function loadStudents() {
    const refreshButton = getElement("refreshStudents");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.textContent = "Loading...";
    }

    try {
        const data = await request(API);

        if (!Array.isArray(data)) {
            throw new Error("Student records could not be loaded.");
        }

        students = data;

        currentPage = 1;

        updateDashboard();
        updateCourseFilter();
        displayStudents();

    } catch (error) {
        console.error(error);
        showNotification(error.message, "error");

    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "↻ Refresh";
        }
    }
}

// =====================================================
// DASHBOARD AND ANALYTICS STATISTICS
// =====================================================

function updateDashboard() {
    const total = students.length;

    const courses = new Set(
        students.map(student => student.course).filter(Boolean)
    );

    function countYear(year) {
        return students.filter(student =>
            String(student.year_level || "").trim().toLowerCase() ===
            year.toLowerCase()
        ).length;
    }

    const first = countYear("1st Year");
    const second = countYear("2nd Year");
    const third = countYear("3rd Year");
    const fourth = countYear("4th Year");
    const fifth = countYear("5th Year");

    // DASHBOARD CARDS

    const dashboardValues = {
        totalStudents: total,
        dashboardCourses: courses.size,
        dashboardFirstYear: first,
        dashboardSecondYear: second,
        dashboardThirdYear: third,
        dashboardFourthYear: fourth,
        dashboardFifthYear: fifth
    };

    Object.entries(dashboardValues).forEach(([id, value]) => {
        const element = getElement(id);

        if (element) {
            element.textContent = value;
        }
    });

    // ANALYTICS CARDS

    const analyticsValues = {
        analyticsTotal: total,
        analyticsCourses: courses.size,
        analyticsFirstYear: first,
        analyticsSecondYear: second,
        analyticsThirdYear: third,
        analyticsFourthYear: fourth,
        analyticsFifthYear: fifth
    };

    Object.entries(analyticsValues).forEach(([id, value]) => {
        const element = getElement(id);

        if (element) {
            element.textContent = value;
        }
    });

    displayCourseAnalytics();
    displayYearAnalytics();
}

// =====================================================
// COURSE ANALYTICS
// =====================================================

function displayCourseAnalytics() {
    const container = getElement("analyticsCourseChart");

    if (!container) return;

    const courseCounts = {};

    students.forEach(student => {
        const course = student.course || "Unspecified";

        courseCounts[course] = (courseCounts[course] || 0) + 1;
    });

    const courses = Object.entries(courseCounts);

    if (courses.length === 0) {
        container.innerHTML = `
            <h3>Course Distribution</h3>
            <p>No course information available yet.</p>
        `;
        return;
    }

    const maxCount = Math.max(...courses.map(item => item[1]));

    container.innerHTML = `
        <h3>Course Distribution</h3>

        ${courses.map(([course, count]) => {
            const percentage = (count / maxCount) * 100;

            return `
                <div class="analytics-row">

                    <div class="analytics-info">
                        <span>${escapeHTML(course)}</span>
                        <strong>${count} students</strong>
                    </div>

                    <div class="analytics-bar">
                        <div style="width:${percentage}%"></div>
                    </div>

                </div>
            `;
        }).join("")}
    `;
}

// =====================================================
// YEAR LEVEL ANALYTICS
// =====================================================

function displayYearAnalytics() {
    const container = getElement("analyticsYearChart");

    if (!container) return;

    const yearLevels = [
        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year",
        "5th Year"
    ];

    const counts = yearLevels.map(year => ({
        year,
        count: students.filter(student =>
            String(student.year_level || "").trim().toLowerCase() ===
            year.toLowerCase()
        ).length
    }));

    const maxCount = Math.max(
        1,
        ...counts.map(item => item.count)
    );

    container.innerHTML = `
        <h3>Year-Level Distribution</h3>

        ${counts.map(item => {
            const percentage = (item.count / maxCount) * 100;

            return `
                <div class="analytics-row">

                    <div class="analytics-info">
                        <span>${item.year}</span>
                        <strong>${item.count} students</strong>
                    </div>

                    <div class="analytics-bar">
                        <div style="width:${percentage}%"></div>
                    </div>

                </div>
            `;
        }).join("")}
    `;
}

// =====================================================
// COURSE FILTER
// =====================================================

function updateCourseFilter() {
    const filter = getElement("courseFilter");

    if (!filter) return;

    const current = filter.value;

    const courses = [
        ...new Set(students.map(student => student.course).filter(Boolean))
    ].sort();

    filter.innerHTML = `
        <option value="">All Courses</option>

        ${courses.map(course => `
            <option value="${escapeHTML(course)}">
                ${escapeHTML(course)}
            </option>
        `).join("")}
    `;

    filter.value = courses.includes(current) ? current : "";
}

// =====================================================
// FILTER AND SORT STUDENTS
// =====================================================

function getFilteredStudents() {
    const search = (searchInput?.value || "").toLowerCase().trim();

    const course = getElement("courseFilter")?.value || "";
    const year = getElement("yearFilter")?.value || "";

    let result = students.filter(student => {
        const searchable = [
            student.id,
            student.name,
            student.course,
            student.year_level
        ];

        const matchesSearch = searchable.some(value =>
            String(value ?? "").toLowerCase().includes(search)
        );

        const matchesCourse = !course || student.course === course;
        const matchesYear = !year || student.year_level === year;

        return matchesSearch && matchesCourse && matchesYear;
    });

    result.sort((a, b) => {
        const first = a[sortField];
        const second = b[sortField];

        if (sortField === "id") {
            return sortDirection === "asc"
                ? Number(first) - Number(second)
                : Number(second) - Number(first);
        }

        const firstText = String(first ?? "").toLowerCase();
        const secondText = String(second ?? "").toLowerCase();

        return sortDirection === "asc"
            ? firstText.localeCompare(secondText)
            : secondText.localeCompare(firstText);
    });

    return result;
}

function resetAndRender() {
    currentPage = 1;
    displayStudents();
}

// =====================================================
// DISPLAY STUDENT RECORDS
// =====================================================

function displayStudents() {
    if (!tableBody) return;

    const filtered = getFilteredStudents();

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / pageSize)
    );

    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;

    const pageStudents = filtered.slice(
        start,
        start + pageSize
    );

    tableBody.innerHTML = "";

    if (pageStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No student records found.
                </td>
            </tr>
        `;
    } else {
        pageStudents.forEach((student, index) => {
            const row = document.createElement("tr");

            // Sequential display number, not database ID.
            const studentNumber = start + index + 1;

            row.innerHTML = `
                <td>${studentNumber}</td>

                <td>
                    <strong>${escapeHTML(student.name)}</strong>
                </td>

                <td>${escapeHTML(student.course)}</td>

                <td>
                    <span class="year-badge">
                        ${escapeHTML(student.year_level)}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="edit-btn"
                        data-action="edit"
                        data-id="${escapeHTML(student.id)}">
                        Edit
                    </button>

                    <button
                        type="button"
                        class="delete-btn"
                        data-action="delete"
                        data-id="${escapeHTML(student.id)}">
                        Delete
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    displayPagination(filtered.length, totalPages);
}

// =====================================================
// PAGINATION
// =====================================================

function displayPagination(total, totalPages) {
    const container = getElement("studentPagination");

    if (!container) return;

    const start = total === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;

    const end = Math.min(currentPage * pageSize, total);

    container.innerHTML = `
        <span>
            Showing ${start}-${end} of ${total} students
        </span>

        <div class="pagination-buttons">

            <button
                type="button"
                data-page="previous"
                ${currentPage === 1 ? "disabled" : ""}>
                Previous
            </button>

            <span>Page ${currentPage} of ${totalPages}</span>

            <button
                type="button"
                data-page="next"
                ${currentPage === totalPages ? "disabled" : ""}>
                Next
            </button>

        </div>
    `;

    // Event delegation prevents duplicate click listeners.
    container.onclick = function(event) {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) return;

        if (button.dataset.page === "previous" && currentPage > 1) {
            currentPage--;
        }

        if (
            button.dataset.page === "next" &&
            currentPage < totalPages
        ) {
            currentPage++;
        }

        displayStudents();
    };
}

// =====================================================
// ADD STUDENT
// =====================================================

getElement("addStudentBtn").addEventListener("click", () => {
    editingStudentId = null;

    studentForm.reset();

    getElement("studentFormTitle").textContent = "Add New Student";
    saveButton.textContent = "Save Student";

    showPage("form");

    getElement("studentName").focus();
});

// =====================================================
// SAVE OR UPDATE STUDENT
// =====================================================

studentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const student = {
        name: getElement("studentName").value.trim(),
        course: getElement("studentCourse").value.trim(),
        year_level: getElement("studentYear").value
    };

    if (!student.name || !student.course || !student.year_level) {
        showNotification("Please complete all fields.", "error");
        return;
    }

    const isEditing = editingStudentId !== null;

    const url = isEditing
        ? `${API}/${editingStudentId}`
        : API;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        await request(url, {
            method: isEditing ? "PUT" : "POST",
            body: JSON.stringify(student)
        });

        showNotification(
            isEditing
                ? "Student updated successfully!"
                : "New student added successfully!"
        );

        editingStudentId = null;

        studentForm.reset();

        await loadStudents();

        showPage("students");

    } catch (error) {
        console.error(error);
        showNotification(error.message, "error");

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Student";
    }
});

// =====================================================
// EDIT STUDENT
// =====================================================

function editStudent(id) {
    const student = students.find(
        item => String(item.id) === String(id)
    );

    if (!student) {
        showNotification("Student not found.", "error");
        return;
    }

    editingStudentId = student.id;

    getElement("studentName").value = student.name;
    getElement("studentCourse").value = student.course;
    getElement("studentYear").value = student.year_level;

    getElement("studentFormTitle").textContent =
        "Edit Student Information";

    saveButton.textContent = "Update Student";

    showPage("form");
}

// =====================================================
// DELETE STUDENT
// =====================================================

async function deleteStudent(id) {
    const student = students.find(
        item => String(item.id) === String(id)
    );

    if (!student) return;

    const confirmed = confirm(
        `Are you sure you want to delete ${student.name}?`
    );

    if (!confirmed) return;

    try {
        await request(`${API}/${id}`, {
            method: "DELETE"
        });

        showNotification("Student deleted successfully!");

        await loadStudents();

    } catch (error) {
        console.error(error);
        showNotification(error.message, "error");
    }
}

// =====================================================
// TABLE ACTIONS
// =====================================================

tableBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;

    if (button.dataset.action === "edit") {
        editStudent(id);
    }

    if (button.dataset.action === "delete") {
        deleteStudent(id);
    }
});

// =====================================================
// CANCEL STUDENT FORM
// =====================================================

getElement("cancelStudent").addEventListener("click", () => {
    closeStudentForm();
});

function closeStudentForm() {
    editingStudentId = null;

    studentForm.reset();

    getElement("studentFormTitle").textContent = "Add Student";

    saveButton.textContent = "Save Student";

    showPage("students");
}

// =====================================================
// SEARCH
// =====================================================

searchInput.addEventListener("input", resetAndRender);

// =====================================================
// EXPORT CSV
// =====================================================

function exportCSV() {
    const filtered = getFilteredStudents();

    if (filtered.length === 0) {
        showNotification("No records available to export.", "error");
        return;
    }

    const headers = [
        "Student Number",
        "Student Name",
        "Course",
        "Year Level"
    ];

    const rows = filtered.map((student, index) => [
        index + 1,
        student.name,
        student.course,
        student.year_level
    ]);

    function csvCell(value) {
        let text = String(value ?? "");

        if (/^[\s]*[=+\-@]/.test(text)) {
            text = "'" + text;
        }

        return `"${text.replace(/"/g, '""')}"`;
    }

    const csv = [headers, ...rows]
        .map(row => row.map(csvCell).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "student-management-records.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showNotification("Student records exported successfully!");
}

// =====================================================
// PRINT STUDENT RECORDS
// =====================================================

function printRecords() {
    const filtered = getFilteredStudents();

    if (filtered.length === 0) {
        showNotification("No student records to print.", "error");
        return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        showNotification(
            "Please allow pop-ups to print student records.",
            "error"
        );
        return;
    }

    const rows = filtered.map((student, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.course)}</td>
            <td>${escapeHTML(student.year_level)}</td>
        </tr>
    `).join("");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Records</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                }

                h1 {
                    text-align: center;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 25px;
                }

                th, td {
                    border: 1px solid #ccc;
                    padding: 12px;
                    text-align: left;
                }

                th {
                    background: #eee;
                }

                .date {
                    text-align: right;
                    margin-top: 20px;
                    font-size: 12px;
                }
            </style>
        </head>

        <body>
            <h1>Student Management System</h1>
            <h3>Student Records</h3>

            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Name</th>
                        <th>Course</th>
                        <th>Year Level</th>
                    </tr>
                </thead>

                <tbody>${rows}</tbody>
            </table>

            <p class="date">
                Generated: ${new Date().toLocaleString()}
            </p>

            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

// =====================================================
// START APPLICATION
// =====================================================

initializeDashboard();
initializeNavigation();
loadStudents();
