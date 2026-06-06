def generate_markdown_report(report: dict) -> str:
    lines = []
    lines.append("# 简历评估报告\n")

    score = report.get("overall_score", 0)
    lines.append(f"## 综合评分：{score} / 100\n")

    summary = report.get("summary", "")
    if summary:
        lines.append(f"> {summary}\n")

    lines.append("## 各维度评分\n")
    lines.append("| 维度 | 评分 | 总评 |")
    lines.append("|------|------|------|")
    for dim in report.get("dimensions", []):
        name = dim.get("dimension", "")
        s = dim.get("score", 0)
        bar = "█" * s + "░" * (10 - s)
        summ = dim.get("summary", "")
        lines.append(f"| {name} | {bar} {s}/10 | {summ} |")
    lines.append("")

    issues = report.get("issues", [])
    if issues:
        lines.append(f"## 问题清单（共 {len(issues)} 项）\n")
        for i, issue in enumerate(issues, 1):
            dim = issue.get("dimension", "")
            problem = issue.get("problem", "")
            impact = issue.get("impact", "")
            suggestion = issue.get("suggestion", "")
            location = issue.get("location", "")

            lines.append(f"### 问题 {i}：{problem}\n")
            if location:
                lines.append(f"- **位置**：{location}")
            lines.append(f"- **所属维度**：{dim}")
            lines.append(f"- **负面影响**：{impact}")
            lines.append(f"- **修改建议**：{suggestion}")
            lines.append("")

    lines.append("---")
    lines.append("*本报告由简历评估优化系统自动生成*")

    return "\n".join(lines)
