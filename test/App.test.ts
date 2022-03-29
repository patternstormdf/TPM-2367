import {app} from "../Application"
import {APIGatewayProxyEvent} from "aws-lambda"
import {Vote, Voting, handler as VoteHandler} from "../src/api/Vote"
import {Endpoint} from "../src/api/Endpoint"
import {Result, Results, handler as ResultHandler} from "../src/api/Result"
import {randomUUID} from "crypto"
import {isDefined} from "../src/api/Utils"

test("deploy application", async (done) => {
    await app.deploy("p2vtpm")
    done()
}, 1000000)

test("undeploy application", async (done) => {
    await app.undeploy("p2vtpm")
    done()
}, 1000000)

const event: APIGatewayProxyEvent = {
    httpMethod: "",
    resource: "",
    body: JSON.stringify({}),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: "",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
        accountId: "",
        apiId: "",
        authorizer: {},
        protocol: "",
        httpMethod: "",
        identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
            clientCert: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            sourceIp: "",
            user: null,
            userAgent: null,
            userArn: null
        },
        path: "",
        stage: "",
        requestId: "",
        requestTimeEpoch: 0,
        resourceId: "",
        resourcePath: ""
    }
}

async function vote(voter: string, candidate: string): Promise<Endpoint.Response> {
    const vote: Vote = {
        "candidate": candidate,
        "voter": voter
    }
    event.resource = "/vote"
    event.httpMethod = "POST"
    event.body = JSON.stringify(vote)
    return await VoteHandler(event)
}

async function closeVoting(): Promise<Endpoint.Response> {
    event.resource = "/close"
    event.httpMethod = "POST"
    event.queryStringParameters = {"accessKey": Result.accessKey}
    return await VoteHandler(event)
}

async function result(accessKey?: string): Promise<Endpoint.Response> {
    event.resource = "/result"
    event.httpMethod = "GET"
    if (isDefined(accessKey)) event.queryStringParameters = {"accessKey": accessKey}
    return await ResultHandler(event)
}

test("vote for existing candidate", async (done) => {
    const voter: string = `${randomUUID()}@voter.com`
    const response: Endpoint.Response = await vote(voter, "john.smith@mastercode.com")
    console.log(JSON.stringify(response))
    done()
})

test("vote for non existing candidate", async (done) => {
    const response: Endpoint.Response = await vote("claudi.paniagua@devfactory.com", "peter.smith@mastercode.com")
    console.log(JSON.stringify(response))
    done()
})

test("get results with correct access key", async (done) => {
    const response: Endpoint.Response = await result(Result.accessKey)
    console.log(JSON.stringify(response))
    done()
})

test("get results with missing access key", async (done) => {
    const response: Endpoint.Response = await result()
    console.log(JSON.stringify(response))
    done()
})

test("get results with incorrect access key", async (done) => {
    const response: Endpoint.Response = await result("1234")
    console.log(JSON.stringify(response))
    done()
})

function random(min: number, max: number): number {
    return Math.floor(Math.random() * ((max + 1) - min) + min)
}

export async function delay(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const expectedResults: Map<string, number> = new Map()

test("simulate voting and results gathering", async (done) => {
    Voting.candidates.map(candidate => expectedResults.set(candidate, 0))
    let votes: number = 0
    let response: Endpoint.Response = await result(Result.accessKey)
    let results: Results = JSON.parse(response.body)
    results.results.map(result => expectedResults.set(result.candidate, result.votes))

    //Voting...
    while (votes < 1000) {
        const candidate: string = Voting.candidates[random(0, 1)]
        const voter: string = `${randomUUID()}.gmail.com`
        try {
            console.log(`Sending vote for ${candidate} from ${voter}`)
            const response: Endpoint.Response = await vote(voter, candidate)
            if (response.statusCode != 200) {
                console.log(`ERROR: Could not process vote for ${candidate} from ${voter}. err=${JSON.stringify(response.body)}`)
            } else {
                console.log(`Vote for ${candidate} from ${voter} successfully processed!`)
                const votes: number = expectedResults.get(candidate) as number
                expectedResults.set(candidate, votes + 1)
            }
            if (votes % 10 == 0) {
                console.log(`Getting partial results...`)
                const response: Endpoint.Response = await result(Result.accessKey)
                const results: Result[] = JSON.parse(response.body)
                console.log(`Partial results=${JSON.stringify(results)}`)
            }
        } catch (err: any) {
            console.log(`ERROR: Could not process vote for ${candidate} from ${voter}. err=${err.message}`)
        }
        await delay(100)
        votes = votes + 1
    }

    //Close voting
    console.log("Closing voting...")
    await closeVoting()

    //Gather results
    let countFinished: boolean = false
    console.log("Waiting for vote counting to finish...")
    while (!countFinished) {
        console.log("Checking if vote counting finished...")
        const response: Endpoint.Response = await result(Result.accessKey)
        const results: Results = JSON.parse(response.body)
        countFinished = results.final
        if (!countFinished) console.log(`Partial results=${JSON.stringify(results)}`)
        await delay(1000)
    }

    console.log("Retrieving final results...")
    response = await result(Result.accessKey)
    results = JSON.parse(response.body)
    console.log(`Final results=${JSON.stringify(results)}`)
    results.results.map(result => {
        expect(result.votes).toBe(expectedResults.get(result.candidate) as number)
    })
    expect(results.final).toBe(true)
    done()
}, 1000000)

test("simulate voting and results gathering with concurrency", async (done) => {
    Voting.candidates.map(candidate => expectedResults.set(candidate, 0))
    let voteCount: number = 0
    let votes: Vote[] = []
    let response: Endpoint.Response = await result(Result.accessKey)
    let results: Results = JSON.parse(response.body)
    results.results.map(result => expectedResults.set(result.candidate, result.votes))

    while (voteCount < 1000) {
        votes = votes.concat({ candidate: Voting.candidates[random(0, 1)], voter: `${randomUUID()}.gmail.com`})
        voteCount = voteCount + 1
    }

    await Promise.all(votes.map(async x => {
        const candidate: string = x.candidate
        const voter: string = x.voter
        try {
            console.log(`Sending vote for ${candidate} from ${voter}`)
            const response: Endpoint.Response = await vote(voter, candidate)
            if (response.statusCode != 200) {
                console.log(`ERROR: Could not process vote for ${candidate} from ${voter}. err=${JSON.stringify(response.body)}`)
            } else {
                console.log(`Vote for ${candidate} from ${voter} successfully processed!`)
                const votes: number = expectedResults.get(candidate) as number
                expectedResults.set(candidate, votes + 1)
            }
            if (voteCount % 10 == 0) {
                console.log(`Getting partial results...`)
                const response: Endpoint.Response = await result(Result.accessKey)
                const results: Result[] = JSON.parse(response.body)
                console.log(`Partial results=${JSON.stringify(results)}`)
            }
        } catch (err: any) {
            console.log(`ERROR: Could not process vote for ${candidate} from ${voter}. err=${err.message}`)
        }
        await delay(100)
    }))

    //Close voting
    console.log("Closing voting...")
    await closeVoting()

    //Gather results
    let countFinished: boolean = false
    console.log("Waiting for vote counting to finish...")
    while (!countFinished) {
        console.log("Checking if vote counting finished...")
        const response: Endpoint.Response = await result(Result.accessKey)
        const results: Results = JSON.parse(response.body)
        countFinished = results.final
        if (!countFinished) console.log(`Partial results=${JSON.stringify(results)}`)
        await delay(1000)
    }

    console.log("Retrieving final results...")
    response = await result(Result.accessKey)
    results = JSON.parse(response.body)
    console.log(`Final results=${JSON.stringify(results)}`)
    results.results.map(result => {
        expect(result.votes).toBe(expectedResults.get(result.candidate) as number)
    })
    expect(results.final).toBe(true)
    done()
}, 1000000)
