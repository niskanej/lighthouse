/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit.js');
const NetworkRecords = require('../computed/network-records.js');
const i18n = require('../lib/i18n/i18n.js');
const MainThreadTasks = require('../computed/main-thread-tasks.js');
const BootupTime = require('./bootup-time.js');

const UIStrings = {
  /** Title of a diagnostic LH audit that provides details on the longest running tasks that occur when the page loads. */
  title: 'Long main thread tasks',
  /** Description of a diagnostic LH audit that tells the user to minimize the amount of long-running tasks on a page. */
  description: 'Lists the longest tasks on the main thread, ' +
    'useful for identifying worst contributors to input delay.',
  /** [ICU Syntax] Label for an audit that tells the user to minimize the amount of long-running tasks on a page. */
  displayValue: `{itemCount, plural,
  =1 {1 long task found}
  other {# long tasks found}
  }`,
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class LongTasks extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'long-tasks',
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      requiredArtifacts: ['traces', 'devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const tasks = await MainThreadTasks.request(trace, context);
    const devtoolsLog = artifacts.devtoolsLogs[LongTasks.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);

    const jsURLs = BootupTime.getJavaScriptURLs(networkRecords);
    const longtasks = [...tasks]
      .filter(t => t.duration >= 50 && !t.unbounded && !t.parent)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);

    const results = longtasks.map(task => ({
      url: BootupTime.getAttributableURLForTask(task, jsURLs),
      group: task.group.label,
      start: task.startTime,
      self: task.selfTime,
      duration: task.duration,
    }));

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'url', itemType: 'url', text: str_(i18n.UIStrings.columnURL)},
      {key: 'start', itemType: 'ms', granularity: 10, text: str_(i18n.UIStrings.columnStartTime)},
      {key: 'duration', itemType: 'ms', granularity: 10, text: str_(i18n.UIStrings.columnDuration)},
    ];

    const tableDetails = Audit.makeTableDetails(headings, results);

    let displayValue;
    if (results.length > 0) {
      displayValue = str_(UIStrings.displayValue, {itemCount: results.length});
    }

    return {
      score: 1,
      details: tableDetails,
      displayValue,
    };
  }
}

module.exports = LongTasks;
module.exports.UIStrings = UIStrings;
