const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers');

let browser, open;
before(async () => ({ browser, open } = await launch()));
after(() => browser.close());

// click via the DOM so the open/close animation of the review panel can't intercept the pointer
const tick = (page, sel) => page.$eval(sel, e => e.click());
const next = page => page.click('#qform .fstep.on [data-next]');

test('estimate form: each step validates before advancing', async () => {
  const page = await open('index.html', '#contact');
  await next(page);
  assert.equal(await page.textContent('#e1'), 'Choose a project type to continue.');
  await page.check('#t-kitchen', { force: true });
  await next(page);
  await next(page);
  assert.match(await page.textContent('#e2'), /when you.d like to start/);
  await page.check('#w-asap', { force: true });
  await next(page);
  await page.click('#qform button[type=submit]');
  assert.equal(await page.textContent('#e3'), 'Enter your name.');
  await page.fill('#name', 'Jane Smith');
  await page.click('#qform button[type=submit]');
  assert.match(await page.textContent('#e3'), /phone number or email/);
  await page.close();
});

test('estimate form: back button returns to previous step', async () => {
  const page = await open('index.html', '#contact');
  await page.check('#t-bath', { force: true });
  await next(page);
  await page.click('#qform .fstep.on [data-back]');
  assert.ok(await page.locator('#qform .fstep').first().evaluate(e => e.classList.contains('on')));
  await page.close();
});

test('estimate form: successful submit shows personalised message and records request', async () => {
  const page = await open('index.html', '#contact');
  await page.check('#t-kitchen', { force: true });
  await next(page);
  await page.check('#w-3', { force: true });
  await next(page);
  await page.fill('#name', 'Jane Smith');
  await page.fill('#email', 'jane@example.com');
  await page.click('#qform button[type=submit]');
  assert.ok(await page.$eval('#done', e => e.classList.contains('on')));
  const msg = await page.textContent('#doneMsg');
  assert.match(msg, /^Thanks, Jane\./);
  assert.match(msg, /kitchen request \(in 1–3 months\)/);
  assert.equal(await page.$eval('#qform .prog', e => e.hidden), true);
  await page.close();
});

test('review form: validation messages in order', async () => {
  const page = await open('index.html', '#write-review');
  await page.waitForSelector('#reviewWrap.open');
  const submit = () => page.click('#reviewForm button[type=submit]');
  await submit();
  assert.equal(await page.textContent('#rvErr'), 'Choose a star rating.');
  await tick(page, '#r4');
  await submit();
  assert.equal(await page.textContent('#rvErr'), 'Enter your name.');
  await page.fill('#rvName', 'Bob');
  await submit();
  assert.equal(await page.textContent('#rvErr'), 'Choose which project you had done.');
  await page.selectOption('#rvProject', 'Kitchen remodel');
  await page.fill('#rvText', 'too short');
  await submit();
  assert.match(await page.textContent('#rvErr'), /few more words/);
  await page.fill('#rvText', 'Great work from start to finish, highly recommend.');
  await submit();
  assert.match(await page.textContent('#rvErr'), /Check the box/);
  await page.close();
});

test('review form: valid submit shows thank-you with rating', async () => {
  const page = await open('index.html', '#write-review');
  await page.waitForSelector('#reviewWrap.open');
  await tick(page, '#r5');
  await page.fill('#rvName', 'Bob Jones');
  await page.selectOption('#rvProject', 'Bathroom remodel');
  await page.fill('#rvText', 'Great work from start to finish, highly recommend.');
  await tick(page, '#rvOk');
  await page.click('#reviewForm button[type=submit]');
  assert.equal(await page.textContent('#rvDoneMsg'), 'Thanks, Bob. Your 5-star review has been sent to Dan for approval.');
  assert.equal(await page.$eval('#rvBody', e => e.hidden), true);
  await page.close();
});

test('review form: star label updates with rating', async () => {
  const page = await open('index.html', '#write-review');
  await page.waitForSelector('#reviewWrap.open');
  assert.equal(await page.textContent('#starTxt'), 'Tap to rate');
  await tick(page, '#r3');
  assert.equal(await page.textContent('#starTxt'), 'Good');
  await page.close();
});

test('review form: URL query and project shortcut prefill fields', async () => {
  const page = await open('index.html', '#write-review-bath', '?name=Jane%20Smith&where=Fenney&rating=4&email=j@x.com');
  await page.waitForSelector('#reviewWrap.open');
  assert.equal(await page.inputValue('#rvName'), 'Jane Smith');
  assert.equal(await page.inputValue('#rvWhere'), 'Fenney');
  assert.equal(await page.inputValue('#rvEmail'), 'j@x.com');
  assert.equal(await page.inputValue('#rvProject'), 'Bathroom remodel');
  assert.equal(await page.isChecked('#r4'), true);
  await page.close();
});

test('review form: Cancel closes the form', async () => {
  const page = await open('index.html', '#write-review');
  await page.waitForSelector('#reviewWrap.open');
  await page.click('#rvCancel');
  await page.waitForSelector('#reviewWrap:not(.open)');
  assert.equal(await page.textContent('#writeReview'), 'Share a review');
  await page.close();
});
