/**
 * Step Functions Workflow Generator
 * Generates AWS Step Functions state machine (ASL) for pipeline orchestration.
 */

import type { PipelineSpec } from '@eadpa/shared';
import type { GeneratedFile } from '@eadpa/compiler-core';

export class StepFunctionsGenerator {
  generate(spec: PipelineSpec): GeneratedFile[] {
    return [
      this.generateStateMachine(spec),
    ];
  }

  private generateStateMachine(spec: PipelineSpec): GeneratedFile {
    const name = spec.name.replace(/-/g, '_');
    const retries = spec.orchestration?.retries || 3;
    const timeout = (spec.orchestration?.timeout_minutes || 60) * 60;

    const stateMachine = {
      Comment: `EADPA Pipeline: ${spec.name} - Generated workflow`,
      StartAt: 'Initialize',
      TimeoutSeconds: timeout,
      States: {
        Initialize: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:eadpa-pipeline-init',
          Parameters: {
            'pipeline_name': spec.name,
            'pipeline_version': spec.version,
            'run_id.$': '$$.Execution.Id',
            'started_at.$': '$$.Execution.StartTime',
          },
          ResultPath: '$.init',
          Next: 'BronzeIngestion',
          Retry: this.buildRetryConfig(retries),
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'HandleError',
            ResultPath: '$.error',
          }],
        },
        BronzeIngestion: {
          Type: 'Task',
          Resource: 'arn:aws:states:::glue:startJobRun.sync',
          Parameters: {
            JobName: `${name}_bronze`,
            Arguments: {
              '--source_database': spec.source.connection.database || 'default',
              '--source_table': spec.source.connection.table || 'source',
              '--target_path.$': '$.init.target_path',
              '--pipeline_run_id.$': '$.init.run_id',
            },
          },
          ResultPath: '$.bronze',
          Next: 'SilverTransformation',
          Retry: this.buildRetryConfig(retries),
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'HandleError',
            ResultPath: '$.error',
          }],
        },
        SilverTransformation: {
          Type: 'Task',
          Resource: 'arn:aws:states:::glue:startJobRun.sync',
          Parameters: {
            JobName: `${name}_silver`,
            Arguments: {
              '--source_path.$': '$.init.target_path',
              '--target_path.$': '$.init.target_path',
              '--pipeline_run_id.$': '$.init.run_id',
            },
          },
          ResultPath: '$.silver',
          Next: 'GoldAggregation',
          Retry: this.buildRetryConfig(retries),
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'HandleError',
            ResultPath: '$.error',
          }],
        },
        GoldAggregation: {
          Type: 'Task',
          Resource: 'arn:aws:states:::glue:startJobRun.sync',
          Parameters: {
            JobName: `${name}_gold`,
            Arguments: {
              '--source_path.$': '$.init.target_path',
              '--target_path.$': '$.init.target_path',
              '--pipeline_run_id.$': '$.init.run_id',
            },
          },
          ResultPath: '$.gold',
          Next: 'RunQualityChecks',
          Retry: this.buildRetryConfig(retries),
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'HandleError',
            ResultPath: '$.error',
          }],
        },
        RunQualityChecks: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:eadpa-quality-checks',
          Parameters: {
            'pipeline_name': spec.name,
            'run_id.$': '$.init.run_id',
            'target_path.$': '$.init.target_path',
          },
          ResultPath: '$.quality',
          Next: 'CheckQualityGate',
          Retry: this.buildRetryConfig(retries),
          Catch: [{
            ErrorEquals: ['States.ALL'],
            Next: 'HandleError',
            ResultPath: '$.error',
          }],
        },
        CheckQualityGate: {
          Type: 'Choice',
          Choices: [{
            Variable: '$.quality.passed',
            BooleanEquals: true,
            Next: 'NotifySuccess',
          }],
          Default: 'HandleQualityFailure',
        },
        HandleQualityFailure: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:eadpa-notify',
          Parameters: {
            'type': 'quality_failure',
            'pipeline': spec.name,
            'details.$': '$.quality',
          },
          Next: 'PipelineFailed',
        },
        NotifySuccess: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:eadpa-notify',
          Parameters: {
            'type': 'success',
            'pipeline': spec.name,
            'run_id.$': '$.init.run_id',
          },
          Next: 'PipelineComplete',
        },
        PipelineComplete: {
          Type: 'Succeed',
        },
        HandleError: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:eadpa-notify',
          Parameters: {
            'type': 'error',
            'pipeline': spec.name,
            'error.$': '$.error',
          },
          Next: 'PipelineFailed',
        },
        PipelineFailed: {
          Type: 'Fail',
          Error: 'PipelineExecutionFailed',
          Cause: 'Pipeline execution failed - check logs for details',
        },
      },
    };

    return {
      path: 'step_functions/workflow.asl.json',
      content: JSON.stringify(stateMachine, null, 2),
      language: 'json',
      description: 'Step Functions state machine definition (Amazon States Language)',
    };
  }

  private buildRetryConfig(maxRetries: number) {
    return [{
      ErrorEquals: ['States.TaskFailed', 'States.Timeout'],
      IntervalSeconds: 60,
      MaxAttempts: maxRetries,
      BackoffRate: 2.0,
    }];
  }
}
