import {DynamoDBStreamEvent, Context} from "aws-lambda"
import * as AWS from "aws-sdk"
import {DynamoDBRecord} from "aws-lambda/trigger/dynamodb-stream"
import {isDefined, Application as App} from "./Utils"

export interface DynamoDBStreamTumblingWindowEvent extends DynamoDBStreamEvent {
    isFinalInvokeForWindow: boolean
    isWindowTerminatedEarly: boolean
    state: State
}

export type State = {
    voteCounts: { [key: string]: number }
    final: boolean
}

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

async function updateVoteCount(candidate: string, newVotes: number): Promise<void> {
    let voteCount: number | undefined = await getVoteCount(candidate)
    if (!isDefined(voteCount)) voteCount = 0
    voteCount = voteCount + newVotes
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


function countVotes(state: State, records: DynamoDBRecord[]): State {
    console.log(`Updating state=${JSON.stringify(state)}`)
    const tally: State = (Object.keys(state).length == 0) ? {voteCounts: {}, final: false} : state
    records.map(record => {
        if (isClosing(record)) tally.final = true
        else {
            const candidate: string | undefined = getVotedCandidateFrom(record)
            if (isDefined(candidate)) {
                const voteCount: number | undefined = tally.voteCounts[candidate]
                if (!isDefined(voteCount)) tally.voteCounts[candidate] = 1
                else tally.voteCounts[candidate] = voteCount + 1
            }
        }
    })
    console.log(`State updated to ${JSON.stringify(tally)}`)
    return tally
}

export async function handler(event: DynamoDBStreamTumblingWindowEvent, context?: Context): Promise<any> {
    console.log(`DynamoDB Streams Consumer event=${JSON.stringify(event)}`)
    if (isDefined(event)) {
        const state: State = countVotes(event.state, event.Records)
        if (event.isFinalInvokeForWindow || event.isWindowTerminatedEarly) {
            const votedCandidates: string[] = Array.from(Object.keys(state.voteCounts))
            await Promise.all(votedCandidates.map(async candidate => {
                console.log(`Updating vote count for candidate=${candidate}`)
                await updateVoteCount(candidate, state.voteCounts[candidate] as number)
            }))
            if (state.final) {
                console.log("Closing vote count...")
                await saveClosing()
            }
        } else {
            console.log(`Returning state=${JSON.stringify(state)}`)
            return {state: state}
        }
    }
}
