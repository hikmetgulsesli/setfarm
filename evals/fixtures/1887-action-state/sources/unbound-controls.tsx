<input
  className="compact-input"
  data-action="ACT_SEARCH_RECORDS"
  placeholder="Search tasks..."
  type="text"
/>
<div className="task-row" data-action="ACT_SELECT_RECORD">
  <span>Implement OAuth2 Authentication</span>
</div>
<input id="task-title" placeholder="Enter task name" type="text" defaultValue="" />
<select id="task-category">
  <option>Development</option>
  <option>Design</option>
</select>
<button data-action="ACT_SAVE_RECORD" data-action-id="save-record-6" onClick={actions?.["save-record-6"]}>
  Save Record
</button>
