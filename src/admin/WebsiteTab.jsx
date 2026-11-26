import Requests from '../edit/Requests.jsx';

// The website is edited in place at /?edit; this tab links there and lists what's been sent.
export default function WebsiteTab({ client }) {
  return (
    <section>
      <div className="a-head">
        <h1>Website</h1>
        <p className="a-muted">Change the words and photos on your website by clicking on them.</p>
      </div>
      <div className="a-card a-editor-card">
        <div>
          <h2>Edit your website</h2>
          <p className="a-muted">Opens your website with editing turned on. Click any words to change them, or use <i>Change photo</i> on a photo. Nothing changes for visitors until you send your changes and they’re approved.</p>
        </div>
        <a className="a-btn a-btn-big" href="../?edit">Open the website editor</a>
      </div>
      <div className="a-card">
        <h2>Sent changes</h2>
        <Requests client={client} />
      </div>
    </section>
  );
}
