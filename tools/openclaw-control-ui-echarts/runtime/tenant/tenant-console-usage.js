import {
  PAGE_SIZE,
  escapeHtml,
  formatCredits,
  formatDateTime,
  formatNumber,
  getPageValue,
  totalUsagePages,
} from "./tenant-console-controller.js";

export function renderUsageList(controller, renderPagination) {
  const rows = controller.usageItems;
  return `
    <div class="data-table-wrapper">
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>Agent</th>
              <th>耗用总token</th>
              <th>输入</th>
              <th>输出</th>
              <th>缓存读取</th>
              <th>缓存写入</th>
              <th>耗用积分</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.memberUsername ?? row.member_username ?? "-")}</td>
                          <td>${escapeHtml(row.agentName ?? row.agent_name ?? row.agentId ?? row.agent_id ?? "-")}</td>
                          <td>${formatNumber(row.totalTokens ?? row.total_tokens ?? row.tokens)}</td>
                          <td>${formatNumber(row.inputTokens ?? row.input_tokens)}</td>
                          <td>${formatNumber(row.outputTokens ?? row.output_tokens)}</td>
                          <td>${formatNumber(row.cacheReadTokens ?? row.cache_read_tokens)}</td>
                          <td>${formatNumber(row.cacheWriteTokens ?? row.cache_write_tokens)}</td>
                          <td>${escapeHtml(formatCredits(row.creditsUsed ?? row.credits_used))}</td>
                          <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="9" class="oc-tenant-table-empty">暂无耗量记录</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${renderPagination({
        totalItems: controller.usageTotal,
        page: getPageValue(controller),
        totalPages: totalUsagePages(controller),
      })}
    </div>
  `;
}

export { totalUsagePages, PAGE_SIZE };
