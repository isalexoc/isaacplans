# Facebook Pixel Testing Guide

## ✅ Fixes Applied

1. **PageView Initialization**: Fixed timing issue - now waits for pixel to fully load before tracking
2. **Custom Event Tracking**: Improved error handling and event queuing
3. **Duplicate Event Prevention**: Fixed issue where auto-advance was tracking events twice
4. **Development Logging**: Added console logs for debugging (development mode only)

## 🧪 Testing Steps

### 1. Clear Cache & Prepare
```bash
# Clear browser cache or use Incognito/Private mode
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

### 2. Open Browser DevTools
- Press `F12` or right-click → Inspect
- Go to **Console** tab
- Go to **Network** tab (filter by "facebook" or "tr")

### 3. Test PageView Event

1. Navigate to: `https://www.isaacplans.com/en/iul/lead-gen`
2. **Check Console**: Should see pixel initialization (if in development)
3. **Check Network Tab**: Look for request to `facebook.com/tr` with `ev=PageView`
4. **Check Pixel Helper**: Should show PageView event (may take a few seconds)

### 4. Test Custom Events (Step Tracking)

1. **Start the form** on the IUL lead gen page
2. **Complete Step 1** (Retirement Timeline):
   - Select any option
   - Should auto-advance after 500ms
   - **Check Console**: Should see `[Facebook Pixel] Custom event tracked: IULFormStepCompleted`
   - **Check Network Tab**: Look for `trackCustom` call with event name `IULFormStepCompleted`

3. **Complete Step 2** (Current Investments):
   - Select at least one investment
   - Click "Next Step"
   - **Check Console**: Should see tracking log
   - **Check Network Tab**: Should see custom event

4. **Continue through all steps**:
   - Each step completion should trigger a custom event
   - Auto-advance steps (1, 3, 5) should have `auto_advanced: true`
   - Manual steps should have `auto_advanced: false`

### 5. Verify in Facebook Events Manager

1. Go to: https://business.facebook.com/events_manager2
2. Select your Pixel ID: `866476789191859`
3. Click **Test Events** tab
4. Enter your website URL: `https://www.isaacplans.com/en/iul/lead-gen`
5. Interact with the form
6. **You should see**:
   - `PageView` events
   - `IULFormStepCompleted` custom events with all parameters
   - `InitiateCheckout` event when form starts
   - `Lead` event when form is submitted

## 📊 Expected Events

### Standard Events
- **PageView**: On page load and route changes
- **InitiateCheckout**: When form starts (Step 1)
- **Lead**: When form is successfully submitted

### Custom Events
- **IULFormStepCompleted**: Each time a step is completed
  - Parameters include:
    - `step_number`: Current step (1-8)
    - `step_name`: Human-readable step name
    - `progress_percentage`: Completion percentage
    - `auto_advanced`: Boolean (true for auto-advance, false for manual)
    - `interaction_type`: "auto_advance" or "manual_click"
    - Plus many more marketing parameters

## 🔍 Troubleshooting

### Issue: PageView warning in Pixel Helper
**Solution**: 
- Wait 2-3 seconds after page load
- Check Network tab to verify request was sent
- The warning may appear initially but should resolve once pixel loads

### Issue: Custom events not showing in Pixel Helper
**Solution**: 
- Pixel Helper only shows standard events by default
- Use **Facebook Events Manager → Test Events** to see custom events
- Check browser console for tracking logs
- Check Network tab for `trackCustom` requests

### Issue: No events in console
**Solution**:
- Ensure you're in development mode (console logs only show in dev)
- Check Network tab instead
- Verify pixel ID is correct in environment variables
- Check browser console for any JavaScript errors

### Issue: Duplicate events
**Solution**: 
- Should be fixed now, but if you see duplicates:
  - Clear cache and hard refresh
  - Check that auto-advance is calling `handleNext(true)`

## 📝 Event Parameters Reference

Each `IULFormStepCompleted` event includes:

```javascript
{
  step_number: 1-8,
  step_name: "Retirement Timeline" | "Current Investments" | etc.,
  next_step_number: 2-8 | null,
  next_step_name: "Current Investments" | "Complete" | etc.,
  progress_percentage: 0-100,
  next_progress_percentage: 0-100,
  steps_remaining: 0-7,
  steps_completed: 1-8,
  total_steps: 8,
  form_type: "IUL Lead Generation",
  form_id: "iul_lead_gen",
  campaign_source: "iul_lead_gen",
  auto_advanced: true | false,
  interaction_type: "auto_advance" | "manual_click",
  estimated_value: 0-50,
  currency: "USD"
}
```

## ✅ Success Criteria

- [ ] PageView fires on page load (no warning after 2-3 seconds)
- [ ] Custom events fire on each step completion
- [ ] Events visible in Facebook Events Manager Test Events
- [ ] No duplicate events
- [ ] Console logs appear in development mode
- [ ] Network requests show proper event tracking

## 🚀 Next Steps

Once testing confirms everything works:
1. Monitor events in Facebook Events Manager
2. Set up custom conversions based on step completion
3. Create audiences based on form progress
4. Optimize campaigns using step completion data
