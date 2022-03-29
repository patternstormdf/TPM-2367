import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent, Context} from "aws-lambda"
import {Application as App, isDefined, Lambda} from "./Utils"
import * as AWS from "aws-sdk"
import {APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy"

export namespace Result {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})

    export const pkValue: string = "CANDIDATE"

    export const accessKey: string = "874345357454387"

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
            const results: Result[] = output.Items.map(item => {
                    return {
                        candidate: item[App.Table.skName]["S"] as string,
                        votes: +(item["Votes"]["N"] as string)
                    }
                })
            return {
                results: results.filter(result => result.candidate != "closed"),
                final: isFinalResult(results)
            }
        }

        function isFinalResult(results: Result[]): boolean {
            return (results.filter(result => result.candidate == "closed")).length == 1
        }

        export const endpoint: Endpoint = new Endpoint(
            "/result",
            "GET",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                //Retrieve voting results from DynamoDB
                try {
                    if (!isDefined(event.queryStringParameters)) throw new Error("missing access key")
                    const accessKey: string | undefined = event.queryStringParameters["accessKey"]
                    if (!isDefined(accessKey)) throw new Error("missing access key")
                    if (accessKey != Result.accessKey) throw new Error("incorrect access key")
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

const endpoints: Map<string, Endpoint> = new Map()
endpoints.set(Result.Get.endpoint.key, Result.Get.endpoint)

export async function handler(event: APIGatewayProxyEvent, context?: Context): Promise<APIGatewayProxyResult> {
    return Lambda.handler(endpoints)(event)
}

export interface Result {
    candidate: string
    votes: number
}

export interface Results {
    results: Result[]
    final: boolean
}
