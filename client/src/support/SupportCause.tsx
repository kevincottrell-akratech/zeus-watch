import { ArrowDownRight, ArrowRight, Cat, CircleHelp, HeartHandshake, LockKeyhole, ShieldCheck, Stethoscope, Syringe } from 'lucide-react';
import './support-cause.css';

const careAreas = [
  {
    number: '01',
    icon: Cat,
    title: 'Everyday food',
    copy: 'Reliable meals help outdoor cats stay nourished while caretakers keep an eye on appetite, condition, and changing needs.',
    tag: 'Nourishment',
  },
  {
    number: '02',
    icon: Stethoscope,
    title: 'Veterinary care',
    copy: 'Checkups, treatment, and recovery support can make a difficult day safer and more comfortable for a cat.',
    tag: 'Health & recovery',
  },
  {
    number: '03',
    icon: Syringe,
    title: 'TNR, thoughtfully',
    copy: 'Trap-neuter-return (TNR) is a humane approach: cats are safely trapped, spayed or neutered, then returned to their familiar outdoor home.',
    tag: 'Long-term wellbeing',
  },
];

function SupportCause() {
  return (
    <div className="sc-page">
      <div className="sc-topline">
        <span className="sc-mark" aria-hidden="true"><Cat size={17} strokeWidth={1.8} /></span>
        <span>ZEUS WATCH <i>/</i> COMMUNITY CARE</span>
        <span className="sc-prototype"><span /> PROTOTYPE SPACE</span>
      </div>

      <div className="sc-main">
        <section className="sc-assurance" aria-label="Prototype safety notice">
          <div className="sc-assurance-icon"><ShieldCheck size={19} /></div>
          <div>
            <strong>Demonstration only — no donations are processed.</strong>
            <p>This prototype does not collect payment details, and no transaction can happen here. The options below are intentionally unavailable.</p>
          </div>
          <span className="sc-assurance-label">HUMAN-REVIEWED WORKSPACE</span>
        </section>
        <section className="sc-hero" aria-labelledby="sc-title">
          <div className="sc-hero-copy">
            <p className="sc-kicker"><span /> SUPPORT OUR CAUSE</p>
            <h2 id="sc-title">Care takes<br /><em>a whole colony.</em></h2>
            <p className="sc-intro">A steadier life for community cats is built one thoughtful act at a time. Here’s where support can make a difference.</p>
            <a className="sc-text-link" href="#ways-to-help">Explore ways to help <ArrowDownRight size={16} /></a>
          </div>
          <div className="sc-hero-art" aria-label="Illustration of a cat sitting beneath a crescent moon">
            <div className="sc-orbit sc-orbit-one" />
            <div className="sc-orbit sc-orbit-two" />
            <span className="sc-star sc-star-a" aria-hidden="true" />
            <span className="sc-star sc-star-b">·</span>
            <div className="sc-moon" />
            <div className="sc-sun-disc" />
            <div className="sc-cat-illustration"><Cat size={152} strokeWidth={1.05} /></div>
            <div className="sc-art-caption"><span>01 — 03</span><span>CARE, IN EVERY FORM</span></div>
          </div>
        </section>

        <section className="sc-care-section" id="ways-to-help" aria-labelledby="sc-care-title">
          <div className="sc-section-heading">
            <div>
              <p className="sc-kicker">THE NEEDS BEHIND THE WORK</p>
              <h2 id="sc-care-title">Small essentials.<br /><em>Lasting care.</em></h2>
            </div>
            <p>In a real care program, donations could help fund food, veterinary care, and trap-neuter-return. These examples are educational, not a record of funds raised or services provided.</p>
          </div>
          <div className="sc-care-list">
            {careAreas.map(({ number, icon: Icon, title, copy, tag }) => (
              <article className="sc-care-item" key={number}>
                <div className="sc-care-number">{number}</div>
                <div className="sc-care-icon"><Icon size={21} strokeWidth={1.6} /></div>
                <div className="sc-care-content">
                  <div className="sc-care-title-row"><h3>{title}</h3><span>{tag}</span></div>
                  <p>{copy}</p>
                </div>
                <ArrowRight className="sc-care-arrow" size={18} aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section className="sc-giving" aria-labelledby="sc-giving-title">
          <div className="sc-giving-intro">
            <p className="sc-kicker">PAYMENT OPTIONS</p>
            <h2 id="sc-giving-title">Familiar options.<br /><em>Not active here.</em></h2>
            <p>These familiar payment services are shown for demonstration only. Their buttons are disabled: there are no accounts, links, or payment flows in this workspace.</p>
            <div className="sc-private-note"><LockKeyhole size={16} /><span>No payment details are collected here.</span></div>
          </div>
          <div className="sc-payment-list" aria-label="Unavailable demonstration payment options">
            <div className="sc-payment-option">
              <button className="sc-pay-button sc-paypal" type="button" disabled aria-describedby="sc-paypal-note">
                <span className="sc-paypal-mark" aria-hidden="true"><b>P</b><b>P</b></span>
                <span className="sc-paypal-word">PayPal</span>
                <span className="sc-unavailable">Unavailable</span>
              </button>
              <p id="sc-paypal-note">Disabled in this demonstration. No payment can be started.</p>
            </div>
            <div className="sc-payment-option">
              <button className="sc-pay-button sc-cashapp" type="button" disabled aria-describedby="sc-cashapp-note">
                <span className="sc-cashapp-mark" aria-hidden="true">$</span>
                <span className="sc-cashapp-word">Cash App</span>
                <span className="sc-unavailable">Unavailable</span>
              </button>
              <p id="sc-cashapp-note">Disabled in this demonstration. No payment can be started.</p>
            </div>
            <div className="sc-payment-option">
              <button className="sc-pay-button sc-zelle" type="button" disabled aria-describedby="sc-zelle-note">
                <span className="sc-zelle-mark" aria-hidden="true"><i /><i /></span>
                <span className="sc-zelle-word">Zelle</span>
                <span className="sc-unavailable">Unavailable</span>
              </button>
              <p id="sc-zelle-note">Disabled in this demonstration. No payment can be started.</p>
            </div>
          </div>
        </section>

        <section className="sc-boundary" aria-label="About this prototype">
          <div className="sc-boundary-icon"><CircleHelp size={18} /></div>
          <div><strong>A clear boundary matters.</strong><p>Zeus Watch is a fictional, human-reviewed colony-care workspace. This page does not represent a live rescue operation, charitable organization, or donation campaign. No funds are raised here, and no tax or charitable status is claimed.</p></div>
          <HeartHandshake className="sc-boundary-art" size={42} strokeWidth={1.15} aria-hidden="true" />
        </section>

        <footer className="sc-footer">
          <span>ZEUS WATCH <i>·</i> CARE WITH CLARITY</span>
          <span>Fictional prototype <b>—</b> not a live donation service</span>
        </footer>
      </div>
    </div>
  );
}

export default SupportCause;
