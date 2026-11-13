import TeamShell from "../../components/TeamShell";
import topics from "./topics.json";
import "./faq.css";

export default function FaqPage() {
  return <TeamShell title="FAQ">
    <div className="team-faq">
      <nav className="team-faq-index" aria-label="FAQ topics">
        <h2>On this page</h2>
        <ul>{topics.map(([id, title]) => <li key={id}><a href={"#" + id}>{title}</a></li>)}</ul>
      </nav>
      <div className="team-faq-topics">
        {topics.map(([id, title, questions]) => <section key={id} aria-labelledby={id}>
          <h2 id={id}>{title}</h2>
          {questions.map(([question, answer]) => <div key={question} className="team-faq-answer">
            <h3>{question}</h3>
            <p>{answer}</p>
          </div>)}
        </section>)}
      </div>
    </div>
  </TeamShell>;
}
