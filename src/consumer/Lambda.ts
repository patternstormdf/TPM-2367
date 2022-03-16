import { DynamoDBStreamEvent, Context } from "aws-lambda"
import * as AWS from "aws-sdk"
import {DynamoDBRecord} from "aws-lambda/trigger/dynamodb-stream"
import {isDefined, Application as App} from "./Utils"


const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})


function isClosing(record: DynamoDBRecord): boolean {
    if (!isDefined(record.dynamodb)) return false
    if (!isDefined(record.dynamodb.Keys)) return false
    return (record.dynamodb.Keys[App.Table.pkName]["S"] == App.Table.Vote.pkValue)
        && (record.dynamodb.Keys[App.Table.skName]["S"] == "closed")
}

function getVotedCandidateFrom(record: DynamoDBRecord): string | undefined {
    if (!isDefined(record.dynamodb)) return undefined
    if (!isDefined(record.dynamodb.Keys)) return undefined
    if (!isDefined(record.dynamodb.NewImage)) return undefined
    if (record.dynamodb.Keys[App.Table.pkName]["S"] != App.Table.Vote.pkValue) return undefined
    return record.dynamodb.NewImage["Candidate"]["S"]
}

async function saveClosing(): Promise<void> {
    const input: AWS.DynamoDB.Types.PutItemInput = {
        TableName: App.Table.name,
        Item: {
            [App.Table.pkName]: {S: App.Table.Candidate.pkValue},
            [App.Table.skName]: {S: "closed"},
            Votes: {N: "0"}
        }
    }
    await ddb.putItem(input).promise()
}

async function getVoteCount(candidate: string): Promise<number | undefined> {
    const input: AWS.DynamoDB.Types.GetItemInput = {
        TableName: App.Table.name,
        Key: {
            [App.Table.pkName]: {S: App.Table.Candidate.pkValue},
            [App.Table.skName]: {S: candidate}
        }
    }
    const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
    if (!isDefined(output.Item)) return undefined
    return +(output.Item["Votes"]["N"] as string)
}

async function updateVoteCount(candidate: string): Promise<void> {
    let voteCount: number | undefined = await getVoteCount(candidate)
    if (!isDefined(voteCount)) voteCount = 0
    voteCount = voteCount + 1
    const input: AWS.DynamoDB.Types.PutItemInput = {
        TableName: App.Table.name,
        Item: {
            [App.Table.pkName]: {S: App.Table.Candidate.pkValue},
            [App.Table.skName]: {S: candidate},
            Votes: {N: voteCount.toString()}
        }
    }
    await ddb.putItem(input).promise()
}

export async function handler(event: DynamoDBStreamEvent, context?: Context): Promise<any> {
    console.log(`DynamoDB Streams Consumer event=${JSON.stringify(event)}`)
    if (isDefined(event)) {
        await Promise.all(event.Records.map(async record => {
            if (isClosing(record)) {
                console.log("Closing vote count...")
                await saveClosing()
            } else {
                const candidate: string | undefined = getVotedCandidateFrom(record)
                if (isDefined(candidate)) {
                    console.log(`Updating vote count for candidate=${candidate}`)
                    await updateVoteCount(candidate)
                }
            }
        }))
    }
}
