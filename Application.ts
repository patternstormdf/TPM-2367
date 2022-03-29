import {Application, Lambda, DynamoDB, IAM, SQS} from "@pstorm/aws-cdk"
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import {Application as App} from "./src/api/Utils"
import * as ddb from "aws-cdk-lib/aws-dynamodb"
import {Tags} from "aws-cdk-lib";

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
    "Lambda.handler", undefined, lambdaConsumerPermissions, 1)
app.addResource(lambdaConsumer)

const deadLetterQueue: SQS.Queue = new SQS.Queue(`${App.prefixId}-dead-letter-queue`, 5, tags, false)
app.addResource(deadLetterQueue)

const eventSource: DynamoDB.EventSource = new DynamoDB.EventSource(`${App.prefixId}-event-source`,
    table, lambdaConsumer, 20, false, 2, 1, deadLetterQueue,
    20, 2)
app.addEventSource(eventSource)

const lambdaVoteApiPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem"],
    "Allow",
    [table]
)
const lambdaVoteApi: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda-vote-api`, "src/api", tags,
    "Vote.handler", undefined, lambdaVoteApiPermissions)
const lambdaVoteApiInstance: Lambda.Function.Instance = app.addResource(lambdaVoteApi) as Lambda.Function.Instance
const lambdaVoteApiIntegration: apigw.LambdaIntegration = new apigw.LambdaIntegration(lambdaVoteApiInstance.asConstruct)

const lambdaResultApiPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:Query"],
    "Allow",
    [table]
)
const lambdaResultApi: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda-result-api`, "src/api", tags,
    "Result.handler", undefined, lambdaResultApiPermissions, 1)
const lambdaResultApiInstance: Lambda.Function.Instance = app.addResource(lambdaResultApi) as Lambda.Function.Instance
const lambdaResultApiIntegration: apigw.LambdaIntegration = new apigw.LambdaIntegration(lambdaResultApiInstance.asConstruct)

const restApi = new apigw.RestApi(app.stack, `${App.prefixId}-api-gw`)
const restApiTags: Tags = Tags.of(restApi)
tags.map(tag => restApiTags.add(tag.key, tag.value))
const restApiRoot: apigw.IResource = restApi.root
const vote: apigw.IResource = restApiRoot.addResource("vote")
vote.addMethod("POST", lambdaVoteApiIntegration)
const close: apigw.IResource = restApiRoot.addResource("close")
close.addMethod("POST", lambdaVoteApiIntegration)
const result: apigw.IResource = restApiRoot.addResource("result")
result.addMethod("GET", lambdaResultApiIntegration)



