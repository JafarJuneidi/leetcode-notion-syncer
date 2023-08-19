import { Client } from "@notionhq/client";
import { config } from "dotenv";
config();

const notion = new Client({ auth: process.env.NOTION_KEY })

const recentAcSubmissionsQuery = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
            id
            title
            titleSlug
            timestamp
            time
        }
    }
`;

const questionQuery = `
query questionTitle($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty
        topicTags {
            name
        }
    }
}
`;

async function getQuestion(titleSlug) {
    const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com'
        },
        body: JSON.stringify({
            operationName: "questionTitle",
            query: questionQuery,
            variables: {
                titleSlug
            },
        }),
    });
    const data = await res.json();
    return data.data.question;
}

async function getRecentAcSubmissions() {
    const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com'
        },
        body: JSON.stringify({
            query: recentAcSubmissionsQuery,
            variables: {
                limit: 15,
                username: "JafarJuneidi"
            },
        }),
    });
    const data = await res.json();
    return data.data.recentAcSubmissionList;
}

async function getNotionPage(id) {
    const response = await notion.databases.query({
        database_id: process.env.DATABASE_ID,
        filter: {
            "property": "No",
            "number": {
                "equals": id
            }
        },
    });
    if (response.results.length > 0) {
        return response.results[0];
    }
    return null;
};

async function addNotionPage(questionDetails) {
    await notion.pages.create({
        parent: { database_id: process.env.DATABASE_ID },
        properties: {
            Solved: {
                checkbox: true
            },
            Note: {
                rich_text: []
            },
            Level: {
                select: { name: '2' }
            },
            Difficulty: {
                select: { name: questionDetails.difficulty }
            },
            Topics: {
                multi_select: questionDetails.topicTags
            },
            URL: {
                url: `leetcode.com/problems/${questionDetails.titleSlug}`
            },
            No: {
                number: parseInt(questionDetails.questionFrontendId)
            },
            Name: {
                title: [
                    {
                        text: { content: questionDetails.title, link: null },
                    }
                ]
            }
        }
    })
    console.log(`Success! Entry No.${questionDetails.questionFrontendId} added.`);
}

async function updateNotionPage(notionPage) {
    const newLevel = String(parseInt(notionPage.properties.Level.select.name) + 1)

    await notion.pages.update({
        page_id: notionPage.id,
        properties: {
            Level: {
                select: { name: newLevel }
            },
        },
    });

    console.log(`Success! Entry No.${notionPage.properties.No.number} updated.`);
}

(async () => {
    const recentAcSubmissions = await getRecentAcSubmissions();
    const uniqueQuestions = new Set();

    for (let i = 0; i < recentAcSubmissions.length; ++i) {
        const submission = recentAcSubmissions[i];
        let time = submission.time;
        if (time.includes("day") || time.includes("month") || time.includes("year")) {
            break;
        }
        if (uniqueQuestions.has(submission.titleSlug)) {
            continue;
        }
        uniqueQuestions.add(submission.titleSlug);

        const questionDetails = await getQuestion(submission.titleSlug);
        const notionPage = await getNotionPage(parseInt(questionDetails.questionFrontendId));
        if (notionPage == null) {
            addNotionPage(questionDetails);
        } else {
            updateNotionPage(notionPage);
        }
    }
})();
