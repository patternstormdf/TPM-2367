import {Application, Lambda, ApiGateway, DynamoDB, IAM, SQS} from "@pstorm/aws-cdk"
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import {Application as App} from "./src/api/Utils"
import * as ddb from "aws-cdk-lib/aws-dynamodb"

const tags: Application.Resource.Tag[] = [
    {key: "owner", value : "claudi.paniagua@devfactory.com"},
    {key: "purpose", value: "https://devgraph-alp.atlassian.net/browse/TPM-2367"}
]

export const app = Application.new( `${App.prefixId}-app`, App.account, App.region,"Application.ts")

const table: DynamoDB.Table = DynamoDB.Table.new({
    name: App.Table.name,
    tags: tags,
    pkName: App.Table.pkName,
    pkType: App.Table.pkType,
    skName: App.Table.skName,
    skType: App.Table.skType,
    stream: ddb.StreamViewType.NEW_IMAGE})
app.addResource(table)

const lambdaConsumerPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem", "dynamodb:GetItem"],
    "Allow",
    [table]
)
const lambdaConsumer: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda-consumer`, "src/consumer", tags,
    "Lambda.handler", undefined, lambdaConsumerPermissions)
app.addResource(lambdaConsumer)

const deadLetterQueue: SQS.Queue = new SQS.Queue(`${App.prefixId}-dead-letter-queue`, 5, tags, false)
app.addResource(deadLetterQueue)

const eventSource: DynamoDB.EventSource = new DynamoDB.EventSource(`${App.prefixId}-event-source`,
    table, lambdaConsumer, 1, false, 5, 1, deadLetterQueue)
app.addEventSource(eventSource)

const lambdaApiPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem", "dynamodb:Query"],
    "Allow",
    [table]
)
const lambdaApi: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda-api`, "src/api", tags,
    "Lambda.handler", undefined, lambdaApiPermissions, 50)
app.addResource(lambdaApi)

const restApi: ApiGateway.API.REST.Lambda = ApiGateway.API.REST.Lambda.new(`${App.prefixId}-api-gw`, lambdaApi, tags)
const restApiInstance: ApiGateway.API.REST.Lambda.Instance = app.addResource(restApi) as ApiGateway.API.REST.Lambda.Instance
const restApiRoot: apigw.IResource = (restApiInstance.asConstruct as apigw.IRestApi).root
const vote: apigw.IResource = restApiRoot.addResource("vote")
vote.addMethod("POST")
const close: apigw.IResource = restApiRoot.addResource("close")
close.addMethod("POST")
const result: apigw.IResource = restApiRoot.addResource("result")
result.addMethod("GET")



