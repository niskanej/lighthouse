/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit.js');
const NetworkRequest = require('../lib/network-request.js');
const NetworkRecords = require('../computed/network-records.js');
const MainThreadTasksComputed = require('../computed/main-thread-tasks.js');

// These trace events, when not triggered by a script inside a particular task, are just general Chrome overhead.
const BROWSER_TASK_NAMES_SET = new Set([
  'CpuProfiler::StartProfiling',
]);

// These trace events, when not triggered by a script inside a particular task, are GC Chrome overhead.
const BROWSER_GC_TASK_NAMES_SET = new Set([
  'V8.GCCompactor',
  'MajorGC',
  'MinorGC',
]);

class MainThreadTasks extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'main-thread-tasks',
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      title: 'Tasks',
      description: 'Lists the toplevel main thread tasks that executed during page load.',
      requiredArtifacts: ['traces','devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts.NetworkRequest[]} records
   */
  static getJavaScriptURLs(records) {
    /** @type {Set<string>} */
    const urls = new Set();
    for (const record of records) {
      if (record.resourceType === NetworkRequest.TYPES.Script) {
        urls.add(record.url);
      }
    }

    return urls;
  }

  /**
   * @param {LH.Artifacts.TaskNode} task
   * @param {Set<string>} jsURLs
   * @return {string}
   */
  static getAttributableURLForTask(task, jsURLs) {
    const jsURL = task.attributableURLs.find(url => jsURLs.has(url));
    const fallbackURL = task.attributableURLs[0];
    let attributableURL = jsURL || fallbackURL;
    // If we can't find what URL was responsible for this execution, attribute it to the root page
    // or Chrome depending on the type of work.
    if (!attributableURL || attributableURL === 'about:blank') {
      if (BROWSER_TASK_NAMES_SET.has(task.event.name)) attributableURL = 'Browser';
      else if (BROWSER_GC_TASK_NAMES_SET.has(task.event.name)) attributableURL = 'Browser GC';
      else attributableURL = 'Unattributable';
    }

    return attributableURL;
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const tasks = await MainThreadTasksComputed.request(trace, context);
    const devtoolsLog = artifacts.devtoolsLogs[MainThreadTasks.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);

    const jsURLs = MainThreadTasks.getJavaScriptURLs(networkRecords);
    const longtasks = [...tasks].sort((a, b) => b.duration - a.duration)
      .filter(t => t.duration >= 50 && t.unbounded === false && !t.parent)
      .slice(0,20);

    const results = longtasks.map(t => ({
      url: MainThreadTasks.getAttributableURLForTask(t, jsURLs),
      group: t.group.label,
      start: t.startTime,
      self: t.selfTime,
      duration: t.duration,
      end: t.startTime + t.duration,
    }));

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'url', itemType: 'url', granularity: 1, text: 'URL'},
      {key: 'start', itemType: 'ms', granularity: 1, text: 'Start Time'},
      {key: 'duration', itemType: 'ms', granularity: 1, text: 'Duration'},
      {key: 'end', itemType: 'ms', granularity: 1, text: 'End Time'},
    ];

    const tableDetails = Audit.makeTableDetails(headings, results);

    return {
      score: 1,
      details: tableDetails,
    };
  }
}

module.exports = MainThreadTasks;
