const notesInput = document.getElementById("notes");
const analyzeButton = document.getElementById("analyzeButton");

const analysisResult = document.getElementById("analysisResult");
const tagsContainer = document.getElementById("tags");
const adviceText = document.getElementById("advice");

const scoreElement = document.getElementById("score");
const scoreBar = document.getElementById("scoreBar");


// current date

const todayElement = document.getElementById("today");

const today = new Date();

todayElement.textContent = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
});


// workload categories

const categories = {

    academic: {
        name: "ACADEMIC",
        keywords: [
            "study",
            "school",
            "homework",
            "math",
            "mathematics",
            "physics",
            "chemistry",
            "english",
            "reading",
            "writing",
            "lesson",
            "assignment"
        ]
    },

    exam: {
        name: "EXAM",
        keywords: [
            "sat",
            "ielts",
            "exam",
            "test",
            "deadline",
            "score",
            "practice test"
        ]
    },

    sport: {
        name: "PHYSICAL",
        keywords: [
            "volleyball",
            "training",
            "workout",
            "gym",
            "running",
            "sport",
            "practice",
            "match"
        ]
    },

    fatigue: {
        name: "FATIGUE",
        keywords: [
            "tired",
            "exhausted",
            "fatigue",
            "stress",
            "stressed",
            "overwhelmed",
            "burnout",
            "no energy",
            "can't focus",
            "cannot focus"
        ]
    },

    rest: {
        name: "RECOVERY",
        keywords: [
            "rest",
            "sleep",
            "break",
            "recovery",
            "relax"
        ]
    }

};


// calculate workload

function analyzeText(text) {

    const normalizedText = text.toLowerCase();

    let score = 10;

    const detectedCategories = [];


    for (const categoryKey in categories) {

        const category = categories[categoryKey];

        let found = false;

        for (const keyword of category.keywords) {

            if (normalizedText.includes(keyword)) {

                found = true;
                break;

            }

        }


        if (found) {

            detectedCategories.push(category.name);

        }

    }


    // academic load

    if (detectedCategories.includes("ACADEMIC")) {

        score += 20;

    }


    // exam load

    if (detectedCategories.includes("EXAM")) {

        score += 20;

    }


    // physical load

    if (detectedCategories.includes("PHYSICAL")) {

        score += 15;

    }


    // fatigue

    if (detectedCategories.includes("FATIGUE")) {

        score += 25;

    }


    // number of tasks

    const taskIndicators = [
        "need to",
        "have to",
        "finish",
        "complete",
        "tomorrow",
        "today",
        "must"
    ];


    let taskCount = 0;


    for (const indicator of taskIndicators) {

        if (normalizedText.includes(indicator)) {

            taskCount++;

        }

    }


    score += Math.min(taskCount * 3, 15);


    // recovery reduces overload

    if (detectedCategories.includes("RECOVERY")) {

        score -= 5;

    }


    score = Math.max(0, Math.min(score, 100));


    return {
        score,
        detectedCategories
    };

}


// generate recommendation

function generateAdvice(score, categories) {

    if (score >= 80) {

        return "Your workload is critical. Focus only on the highest-priority tasks, reduce intensive study sessions and add recovery time.";

    }


    if (score >= 60) {

        return "Your workload is high. Avoid stacking several demanding tasks together and schedule recovery periods between intensive activities.";

    }


    if (score >= 40) {

        return "Your workload is moderate. Keep the planned schedule, but alternate demanding tasks with shorter recovery periods.";

    }


    return "Your workload appears manageable. You can keep the current study plan and adjust it if your energy level changes.";

}


// update interface

function updateInterface(result) {

    const score = result.score;

    scoreElement.textContent = score;

    scoreBar.style.width = `${score}%`;


    tagsContainer.innerHTML = "";


    if (result.detectedCategories.length === 0) {

        const tag = document.createElement("span");

        tag.className = "tag";

        tag.textContent = "GENERAL";

        tagsContainer.appendChild(tag);

    }


    result.detectedCategories.forEach(category => {

        const tag = document.createElement("span");

        tag.className = "tag";

        tag.textContent = category;

        tagsContainer.appendChild(tag);

    });


    adviceText.textContent =
        generateAdvice(
            score,
            result.detectedCategories
        );


    analysisResult.style.display = "block";

}


// analyze button

analyzeButton.addEventListener("click", () => {

    const text = notesInput.value.trim();


    if (!text) {

        notesInput.focus();

        return;

    }


    const result = analyzeText(text);

    updateInterface(result);

});