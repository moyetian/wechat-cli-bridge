import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { initStorage, storage } from '../utils/storage';
import { resolveBridgeHome } from '../utils/paths';
import {
  LocalGpuMockWorker,
  ResearchExecutor,
} from '../research';
import {
  WEWRITE_MOCK_MODE_ENV,
  WeWriteAdapter,
} from '../writing';

export interface LocalM005MockUatOptions {
  homeDir?: string;
  articleRequest?: string;
  researchRequest?: string;
  workingDir?: string;
  researchFailPattern?: string;
}

export interface LocalM005MockUatResult {
  homeDir: string;
  reportPath: string;
  article: {
    status: string;
    artifactDir: string;
    outlinePath: string;
    draftPath: string;
  };
  research: {
    status: string;
    runId?: string;
    artifactDir: string;
    queueDir: string;
    statusDir: string;
  };
}

function parseArgs(argv: string[]): LocalM005MockUatOptions {
  const parsed: LocalM005MockUatOptions = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--home':
        parsed.homeDir = next;
        index++;
        break;
      case '--article':
        parsed.articleRequest = next;
        index++;
        break;
      case '--research':
        parsed.researchRequest = next;
        index++;
        break;
      case '--working-dir':
        parsed.workingDir = next;
        index++;
        break;
      case '--fail-research':
        parsed.researchFailPattern = next;
        index++;
        break;
      default:
        break;
    }
  }

  return parsed;
}

export async function runLocalM005MockUat(
  options: LocalM005MockUatOptions = {}
): Promise<LocalM005MockUatResult> {
  const homeDir = resolveBridgeHome(
    options.homeDir ||
      path.join(os.tmpdir(), `wechat-cli-bridge-m005-uat-${Date.now()}`)
  );
  const workingDir = path.resolve(options.workingDir || process.cwd());
  const articleRequest =
    options.articleRequest || '写一篇关于 AI 路由的公众号文章';
  const researchRequest =
    options.researchRequest || '开始跑实验，验证 research workflow mock 链路';

  initStorage(homeDir);

  const originalMockMode = process.env[WEWRITE_MOCK_MODE_ENV];
  process.env[WEWRITE_MOCK_MODE_ENV] = 'true';

  try {
    const articleUserId = 'uat-article-user';
    const articleJobId = 'uat-article-job';
    const writingAdapter = new WeWriteAdapter();
    const articleResult = await writingAdapter.prepareWorkflow({
      route: 'article_create',
      requestText: articleRequest,
      userId: articleUserId,
      jobId: articleJobId,
      workingDir,
      defaultAgent: 'codex',
      availableAgents: ['codex'],
    });

    const articleArtifactDir = path.join(
      storage.sessionsDir,
      articleUserId,
      'artifacts',
      articleJobId
    );
    const outlinePath = path.join(articleArtifactDir, 'outline.md');
    const draftPath = path.join(articleArtifactDir, 'draft.md');

    const queueDir = path.join(homeDir, 'research-queue');
    const statusDir = path.join(queueDir, 'status');
    const researchUserId = 'uat-research-user';
    const researchJobId = 'uat-research-job';
    const executor = new ResearchExecutor({
      enabled: true,
      executor: {
        backend: 'local_gpu',
        maxBudgetUSD: 20,
        maxRuntimeMinutes: 60,
        allowNetwork: false,
        localGpu: {
          queueDir,
          statusDir,
          pythonBin: 'python3',
        },
      },
    });

    const submission = await executor.submitRun({
      userId: researchUserId,
      jobId: researchJobId,
      requestText: researchRequest,
      workingDir,
    });

    const worker = new LocalGpuMockWorker({
      queueDir,
      statusDir,
      simulateDurationMs: 0,
      failPattern: options.researchFailPattern,
    });
    await worker.runOnce();

    const researchStatus = submission.runId
      ? await executor.pollRunStatus({
          userId: researchUserId,
          jobId: researchJobId,
          runId: submission.runId,
        })
      : null;

    const researchArtifactDir = path.join(
      storage.sessionsDir,
      researchUserId,
      'artifacts',
      researchJobId,
      'execution'
    );
    const reportDir = path.join(homeDir, 'uat-reports');
    await fs.ensureDir(reportDir);
    const reportPath = path.join(reportDir, 'm005-local-mock-uat.md');
    const report = [
      '# M005 Local Mock UAT',
      '',
      `- Home: ${homeDir}`,
      `- Working Directory: ${workingDir}`,
      '',
      '## Article Lane',
      `- Request: ${articleRequest}`,
      `- Status: ${articleResult.status}`,
      `- Outline: ${outlinePath}`,
      `- Draft: ${draftPath}`,
      '',
      '## Research Lane',
      `- Request: ${researchRequest}`,
      `- Submission Status: ${submission.status}`,
      `- Run ID: ${submission.runId || '(missing)'}`,
      `- Polled Status: ${researchStatus?.status || '(missing)'}`,
      `- Queue Dir: ${queueDir}`,
      `- Status Dir: ${statusDir}`,
      '',
    ].join('\n');
    await fs.writeFile(reportPath, report, 'utf8');

    return {
      homeDir,
      reportPath,
      article: {
        status: articleResult.status,
        artifactDir: articleArtifactDir,
        outlinePath,
        draftPath,
      },
      research: {
        status: researchStatus?.status || submission.status,
        runId: submission.runId,
        artifactDir: researchArtifactDir,
        queueDir,
        statusDir,
      },
    };
  } finally {
    if (originalMockMode === undefined) {
      delete process.env[WEWRITE_MOCK_MODE_ENV];
    } else {
      process.env[WEWRITE_MOCK_MODE_ENV] = originalMockMode;
    }
  }
}

async function main(): Promise<void> {
  const result = await runLocalM005MockUat(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReport: ${result.reportPath}`);
}

if (require.main === module) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[m005-local-uat] failed: ${message}`);
    process.exit(1);
  });
}
