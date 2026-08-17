# International Student Job Board

**Startup and scaleup jobs across Australia for international students and
graduates, mapped with migration pathways and visa requirements**

**[international-student-job-board.github.io](https://international-student-job-board.github.io/)** 👀

Most job boards tell you what a role pays. If you are here on a student or
graduate visa, the question you actually need answered first is different: *what
does this job let me do next?* This board answers that one. Every listing is
matched to its ANZSCO occupation, and from there to the visa subclasses it can
lead to, the skilled-migration lists it appears on, and the authority that would
assess your skills.

The data is checked by hand. A company tagged as an accredited sponsor is on the
Department of Home Affairs list; a company with no tag has not been ruled out,
it has not been checked yet — and the site says so rather than leaving you to
guess.

## Running it

```bash
git clone https://github.com/international-student-job-board/international-student-job-board.github.io.git
cd international-student-job-board.github.io/job-board
npm install
npm start                   # app on :3000, local data server on :4000
```

Both servers matter — started alone, the app has no data to show.

```bash
npm test                    # 188 tests
npm run build:pages         # build into ../docs, which GitHub Pages serves
npm run fetch-occupations   # refresh the occupation reference from Home Affairs
```

Deploying is `npm run build:pages`, then commit and push. It rebuilds `docs/`
from scratch, so anything hand-added there is lost — put static files in
`job-board/public/` instead.

[**job-board/README.md**](job-board/README.md) covers the CSV schema, where the
data lives and why, how the occupation reference is built, and what to do when
the board comes up empty.

## Credits

Built and maintained by **Milindi Kodikara**, an international STEM student in
Australia — which is where the idea came from. If you fork or reuse this, a link
back is appreciated.

[My Two Rupees](https://medium.com/@milindi.beeloud/list/my-two-rupees-2311414b6960)
· [Buy me a coffee](https://ko-fi.com/milindi)
· [Report a problem](https://github.com/international-student-job-board/international-student-job-board.github.io/issues/new)

Visa information here is a general guide compiled from public government
sources, not immigration advice. Always check with a registered migration agent
about your own situation.
