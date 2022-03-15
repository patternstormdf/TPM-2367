import {app} from "../Application"
import {APIGatewayProxyEvent} from "aws-lambda"
import {handler} from "../src/Lambda"
import {Vote} from "../src/Vote"
import {Endpoint} from "../src/Endpoint"

test("deploy application", async(done) => {
    await app.deploy("p2vtpm")
    done()
}, 1000000)

test("undeploy application", async(done) => {
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
        apiId:"",
        authorizer: {},
        protocol: "",
        httpMethod: "",
        identity: {
            accessKey:  null,
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

test("vote for existing candidate", async(done) => {
    const vote: Vote = {
        "candidate": "ilina.maskirovka@mastercode.com",
        "voter": "claudi.pani@devfactory.com"
    }
    event.resource = "/vote"
    event.httpMethod = "POST"
    event.body = JSON.stringify(vote)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("vote for non existing candidate", async(done) => {
    const vote: Vote = {
        "candidate": "peter.smith@mastercode.com",
        "voter": "claudi.paniagua@devfactory.com"
    }
    event.resource = "/vote"
    event.httpMethod = "POST"
    event.body = JSON.stringify(vote)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("get results", async(done) => {
    event.resource = "/result"
    event.httpMethod = "GET"
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})
