/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const LongTasks = require('../../audits/long-tasks.js');

const acceptableTrace = require('../fixtures/traces/progressive-app-m60.json');
const devtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');

/* eslint-env jest */

describe('Long tasks audit', () => {
  it('should filter out top level tasks shorter than 50 ms', async () => {
    const artifacts = {
      traces: {defaultPass: acceptableTrace},
      devtoolsLogs: {defaultPass: devtoolsLog},
    };
    const result = await LongTasks.audit(artifacts, {computedCache: new Map()});
    expect(result.details.items).toHaveLength(4);
    expect(result.displayValue).toBeDisplayString('4 long tasks found');

    for (const item of result.details.items) {
      expect(Number.isFinite(item.start)).toBeTruthy();
      expect(Number.isFinite(item.duration)).toBeTruthy();
      expect(item.duration).toBeGreaterThanOrEqual(50);
    }
  });
});
