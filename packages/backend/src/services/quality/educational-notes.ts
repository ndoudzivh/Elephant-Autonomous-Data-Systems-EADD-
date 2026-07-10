/**
 * EADD Educational Notes Generator
 * 
 * Adds inline "Mentor Notes" to code output explaining WHY decisions
 * were made. Like having a patient senior engineer reviewing your code.
 * 
 * WHY THIS EXISTS:
 * Most AI code generators dump code without context.
 * EADD explains every decision so the user LEARNS, not just copies.
 * 
 * Levels:
 * - beginner:     Explains everything, assumes no prior knowledge
 * - intermediate: Explains decisions & trade-offs, skips basics
 * - expert:       Brief justifications only, non-obvious insights
 */

type ExplanationLevel = 'beginner' | 'intermediate' | 'expert';

// ============================================================
// PATTERN → EXPLANATION MAP
// Each pattern, when detected in code, triggers an educational note
// ============================================================

interface MentorNote {
  pattern: RegExp;
  beginnerNote: string;
  intermediateNote: string;
  expertNote: string;
  /** Only add once per response (avoid repetition) */
  addOnce: boolean;
}


const MENTOR_NOTES: MentorNote[] = [
  {
    pattern: /\.withColumn\(/,
    beginnerNote: `🎓 **Mentor Note — .withColumn()**: This adds or replaces a column in the DataFrame. Spark DataFrames are *immutable* — each .withColumn() returns a NEW DataFrame, leaving the original unchanged. Chain multiple calls for multiple columns.`,
    intermediateNote: `🎓 **.withColumn()** returns a new DataFrame (immutable). For many columns, consider using .select() with expressions for better Catalyst optimization.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /\.withWatermark\(/,
    beginnerNote: `🎓 **Mentor Note — Watermarks**: Tells Spark "how late can data arrive?" Without this, Spark keeps ALL state forever (memory grows until OOM crash). The watermark says "data older than X is considered final — drop the state."`,
    intermediateNote: `🎓 **Watermark**: Controls state cleanup in streaming. Set based on maximum expected event lateness. Too short = missed data. Too long = memory pressure.`,
    expertNote: `🎓 Watermark granularity affects state store size. Consider append vs update output mode interaction.`,
    addOnce: true,
  },
  {
    pattern: /checkpointLocation/,
    beginnerNote: `🎓 **Mentor Note — Checkpoint**: Streaming jobs MUST have this. If the job crashes, it restarts from the last checkpoint (not from zero). Store on durable storage (S3/HDFS), NEVER local disk which is ephemeral on cloud.`,
    intermediateNote: `🎓 **Checkpoint**: Enables exactly-once semantics on restart. Store on S3/ADLS, never local. Changing query logic may require checkpoint reset.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /partitionBy\(/,
    beginnerNote: `🎓 **Mentor Note — Partitioning**: Physically organizes data files into folders by column value. Queries filtering on the partition column skip entire folders (partition pruning). Choose columns with LOW cardinality that you frequently filter on (date, region, country).`,
    intermediateNote: `🎓 **partitionBy**: Enables partition pruning. Choose low-cardinality, frequently-filtered columns. Too many partitions = small file problem.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /\.cache\(\)|\.persist\(/,
    beginnerNote: `🎓 **Mentor Note — Caching**: Keeps the DataFrame in memory for reuse. Use when the SAME DataFrame is accessed multiple times. DON'T cache if used only once (wastes memory). Call .unpersist() when done.`,
    intermediateNote: `🎓 **cache/persist**: Only for DataFrames reused multiple times. Remember to .unpersist() to free executor memory.`,
    expertNote: '',
    addOnce: true,
  },
];


const MENTOR_NOTES_CONTINUED: MentorNote[] = [
  {
    pattern: /broadcast\(/,
    beginnerNote: `🎓 **Mentor Note — Broadcast Join**: For joining a LARGE table with a SMALL table (<100MB). Sends the small table to all executors, avoiding expensive data shuffle. Result: 10-100x faster joins.`,
    intermediateNote: `🎓 **broadcast()**: Avoids shuffle for small dimension tables. Default threshold is 10MB (spark.sql.autoBroadcastJoinThreshold). Increase for larger dims.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /MERGE\s+INTO|merge\s*\(/i,
    beginnerNote: `🎓 **Mentor Note — MERGE (Upsert)**: Combines INSERT + UPDATE in one atomic operation. If the record exists → update it. If not → insert it. This makes pipelines *idempotent* — running twice gives the same result as running once. Critical for production reliability.`,
    intermediateNote: `🎓 **MERGE/Upsert**: Ensures idempotency. Pipeline reruns won't duplicate data. Always prefer over raw INSERT for dimension/fact loading.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /incremental|is_incremental\(\)/i,
    beginnerNote: `🎓 **Mentor Note — Incremental Loading**: Only processes NEW or CHANGED records each run. If your table has 100M rows but only 10K changed, why reprocess all 100M? Saves 99%+ compute cost. The trade-off: must handle deletes separately and needs a reliable watermark column.`,
    intermediateNote: `🎓 **Incremental**: Processes only delta since last run. Requires reliable watermark (updated_at). First run = full load, then switch to incremental. Handle late-arriving data with partition overwrite strategy.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /catchup\s*=\s*False/i,
    beginnerNote: `🎓 **Mentor Note — catchup=False**: Without this, Airflow runs ALL missed intervals on first deploy. If start_date=2020 and schedule=daily, it would try 1500+ backfill runs! Set catchup=False unless you specifically need historical backfill.`,
    intermediateNote: `🎓 **catchup=False**: Prevents mass backfill on first deploy. Enable only for intentional historical processing.`,
    expertNote: '',
    addOnce: true,
  },
  {
    pattern: /great_expectations|expect_column/i,
    beginnerNote: `🎓 **Mentor Note — Data Quality Tests**: Pipelines fail SILENTLY — they produce wrong data without errors. Unlike app bugs that crash, a bad JOIN silently duplicates rows. Quality tests (row counts, null checks, uniqueness) are the ONLY way to catch silent failures before they reach dashboards.`,
    intermediateNote: `🎓 **Quality checks**: Catch silent data corruption. Test at every layer boundary (Bronze→Silver, Silver→Gold). Fail fast, quarantine bad records.`,
    expertNote: '',
    addOnce: true,
  },
];



const ALL_MENTOR_NOTES = [...MENTOR_NOTES, ...MENTOR_NOTES_CONTINUED];

// ============================================================
// MAIN EXPORT — Add educational notes to LLM response
// ============================================================

/**
 * Scans the LLM response for code patterns and adds educational
 * mentor notes after relevant code blocks.
 * 
 * Only adds each note ONCE per response to avoid repetition.
 */
export function generateEducationalNotes(
  content: string,
  level: ExplanationLevel
): string {
  if (level === 'expert') {
    // Experts get minimal notes — only non-obvious insights
    return addExpertNotes(content);
  }

  const usedNotes = new Set<number>();
  let enhanced = content;

  // Find code blocks and add relevant notes after them
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ fullMatch: string; code: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      fullMatch: match[0],
      code: match[2],
      index: match.index,
    });
  }

  // Process blocks in reverse order so indices stay valid
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const notesToAdd: string[] = [];

    for (let noteIdx = 0; noteIdx < ALL_MENTOR_NOTES.length; noteIdx++) {
      const note = ALL_MENTOR_NOTES[noteIdx];
      if (note.addOnce && usedNotes.has(noteIdx)) continue;

      if (note.pattern.test(block.code)) {
        const noteText = level === 'beginner'
          ? note.beginnerNote
          : note.intermediateNote;

        if (noteText) {
          notesToAdd.push(noteText);
          usedNotes.add(noteIdx);
        }
      }
    }

    if (notesToAdd.length > 0) {
      const insertPos = block.index + block.fullMatch.length;
      const noteBlock = '\n\n' + notesToAdd.join('\n\n') + '\n';
      enhanced = enhanced.slice(0, insertPos) + noteBlock + enhanced.slice(insertPos);
    }
  }

  return enhanced;
}

function addExpertNotes(content: string): string {
  // For experts, only add non-obvious performance/gotcha notes
  let enhanced = content;

  for (const note of ALL_MENTOR_NOTES) {
    if (note.expertNote && note.pattern.test(content)) {
      // Add as a subtle inline note at the end
      enhanced += `\n\n> ${note.expertNote}`;
    }
  }

  return enhanced;
}
