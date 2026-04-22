function parseIssueRef(issueRef, defaultRepo, options = {}) {
  const missingIssueMessage = options.missingIssueMessage || '缺少 issue 参数';
  const missingRepoMessage = options.missingRepoMessage || '当前未配置 GitHub repo，不能只传 issue number';

  if (!issueRef) {
    throw new Error(missingIssueMessage);
  }
  if (/^\d+$/.test(issueRef)) {
    if (!defaultRepo) {
      throw new Error(missingRepoMessage);
    }
    return {
      repo: defaultRepo,
      number: Number(issueRef),
      url: `https://github.com/${defaultRepo}/issues/${issueRef}`,
    };
  }

  const match = issueRef.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:[/?#].*)?$/);
  if (!match) {
    throw new Error(`无法解析 issue: ${issueRef}`);
  }
  return {
    repo: match[1],
    number: Number(match[2]),
    url: issueRef,
  };
}

module.exports = {
  parseIssueRef,
};
