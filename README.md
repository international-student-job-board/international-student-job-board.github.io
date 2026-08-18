# International Student Job Board

**Startup and scaleup jobs across Australia for international students and
graduates, mapped with migration pathways and visa requirements**

**[international-student-job-board.github.io](https://international-student-job-board.github.io/)** 👀

## Running it

```bash
cd international-student-job-board.github.io/job-board
npm install
npm start                   # app on :3000, local data server on :4000
```

```bash
npm test                    # 188 tests
npm run build:pages         # build into ../docs, which GitHub Pages serves
npm run fetch-occupations   # refresh the occupation reference from Home Affairs
```

Deploying is `npm run build:pages`, then commit and push. It rebuilds `docs/`
from scratch, so anything hand-added there is lost — put static files in
`job-board/public/` instead.

## Credits

Built and maintained by **Milindi Kodikara**, an international STEM student in
Australia.

[My Two Rupees](https://medium.com/@milindi.beeloud/list/my-two-rupees-2311414b6960)
· [Buy me a coffee](https://ko-fi.com/milindi)
· [Report a problem](https://github.com/international-student-job-board/international-student-job-board.github.io/issues/new)

Visa information here is a general guide compiled from public government
sources, not immigration advice. Always check with a registered migration agent
about your own situation.
