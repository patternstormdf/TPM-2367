import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent} from "aws-lambda"
import {Application as App, isDefined} from "./Utils"
import * as AWS from "aws-sdk"

export namespace Result {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})

    export const pkValue: string = "CANDIDATE"

    export namespace Get {

        async function retrieve(): Promise<Results> {
            const input: AWS.DynamoDB.Types.QueryInput = {
                TableName: App.Table.name,
                KeyConditionExpression: `${App.Table.pkName} = :x`,
                ExpressionAttributeValues: {
                    ":x": {S: pkValue}
                }
            }
            const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
            if (!isDefined(output.Items)) throw new Error("DynamoDB.scan returned undefined")
            const results: Results = {
                results: output.Items.map(item => {
                    return {
                        candidate: item[App.Table.skName]["S"] as string,
                        votes: +(item["Votes"]["N"] as string)
                    }
                })
            }
            return results
        }

        export const endpoint: Endpoint = new Endpoint(
            "/result",
            "GET",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                //Retrieve voting results from DynamoDB
                try {
                    const results: Results = await retrieve()
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(results)
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

export interface Result {
    candidate: string
    votes: number
}

export interface Results {
    results: Result[]
}
