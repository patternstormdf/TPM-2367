import {APIGatewayProxyEvent} from "aws-lambda"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"
import {Application as App} from "./Utils"
import * as AWS from "aws-sdk"
import {Result} from "./Result";

export namespace Vote {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})

    export const pkValue: string = "VOTE"

    export namespace Create {

        async function save(vote: Vote): Promise<Vote> {
            console.log(`Saving vote=${JSON.stringify(vote)} into DynamoDB...`)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.pkName]: {S: pkValue},
                    [App.Table.skName]: {S: vote.voter},
                    Candidate: {S: vote.candidate},
                },
                ConditionExpression: `attribute_not_exists(${App.Table.pkName}) and attribute_not_exists(${App.Table.skName})`
            }
            await ddb.putItem(input).promise()
            console.log(`Vote saved into DynamoDB!`)
            return vote
        }

        export const endpoint: Endpoint = new Endpoint(
            "/vote",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    const validDate: boolean | undefined = Voting.Window.isValid(new Date())
                    if (!isDefined(validDate)) throw new Error("Env. variable startDate not defined with the format yyyy-mm-ddThh:mm:ss")
                    if (!validDate) throw new Error("vote received outside the voting window")
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    let vote: Vote = JSON.parse(event.body)
                    if (!Voting.candidates.some(candidate => candidate == vote.candidate))
                        throw new Error("vote for non existing candidate")
                    //Save the vote to the datastore
                    vote = await save(vote)
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(vote)
                    }
                } catch (err: any) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
                return response
            })
    }

    export namespace Close {

        async function save(): Promise<void> {
            console.log(`Closing voting...`)
            const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.pkName]: {S: Vote.pkValue},
                    [App.Table.skName]: {S: "closed"},
                    Votes: {N: "0"}
                }
            }
            await ddb.putItem(input).promise()
            console.log(`Voting Closed!`)
        }

        export const endpoint: Endpoint = new Endpoint(
            "/close",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    if (!isDefined(event.queryStringParameters)) throw new Error("missing access key")
                    const accessKey: string | undefined = event.queryStringParameters["accessKey"]
                    if (!isDefined(accessKey)) throw new Error("missing access key")
                    if (accessKey != Result.accessKey) throw new Error("incorrect access key")
                    //Save the closing to the datastore
                    await save()
                    response = {
                        statusCode: 200,
                        body: JSON.stringify({msg: "Voting closed"})
                    }
                } catch (err: any) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
                return response
            })
    }

}

export interface Vote {
    candidate: string
    voter: string
}

export namespace Voting {

    export namespace Window {

        const startDate: Date | undefined = isDefined(process.env["startDate"])?
            new Date(process.env["startDate"]) : undefined
        const endDate: Date | undefined = isDefined(startDate)?
            new Date(startDate.getTime() + (1000 * 60 * 60 * 24)) : undefined

        export function isValid(date: Date): boolean | undefined {
            if (!isDefined(startDate) || !isDefined(endDate)) return undefined
            const startDateTime: number = startDate.getTime()
            if (isNaN(startDateTime)) return undefined
            const dateTime: number = date.getTime()
            return (dateTime >= startDateTime && dateTime <= endDate.getTime())
        }
    }

    export const candidates: string[] = [
        "john.smith@mastercode.com",
        "ilina.maskirovka@mastercode.com"
    ]
}
