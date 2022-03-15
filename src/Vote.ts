import {APIGatewayProxyEvent} from "aws-lambda"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"
import {Application as App} from "./Utils"
import * as AWS from "aws-sdk"

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
                    if (!Voting.Window.isValid(new Date())) throw new Error("vote received outside the voting window")
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    let vote: Vote = JSON.parse(event.body)
                    if (!Voting.candidates.some(candidate => candidate == vote.candidate)) throw new Error("vote for non existing candidate")
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
}

export interface Vote {
    candidate: string
    voter: string
}

export namespace Voting {

    export namespace Window {

        const startDate = new Date()
        const endDate = new Date(startDate.getTime() + (1000 * 60 * 60 * 24))

        export function isValid(date: Date): boolean {
            const dateTime: number = date.getTime()
            return (dateTime >= startDate.getTime() && dateTime <= endDate.getTime())
        }
    }

    export const candidates: string[] = [
        "john.smith@mastercode.com",
        "ilina.maskirovka@mastercode.com"
    ]
}
