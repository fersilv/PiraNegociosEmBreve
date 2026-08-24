import React from 'react';

export function PublicResumeResponsiveStyles() {
  return (
    <style>{`
      .public-resume-page {
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
      }

      .public-resume-page #public-resume-print-root {
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }

      @media screen and (max-width: 1023px) {
        .public-resume-page #public-resume-print-root,
        .public-resume-page #public-resume-print-root > .resume-a4-document {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .public-resume-page #public-resume-print-root > .resume-a4-document {
          min-height: auto !important;
          overflow: hidden !important;
        }

        .public-resume-page #public-resume-print-root .resume-a4-document {
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .public-resume-page #public-resume-print-root .resume-brand-footer {
          left: 16px;
          right: 16px;
        }
      }

      @media screen and (max-width: 479px) {
        .public-resume-page #public-resume-print-root > .resume-a4-document {
          border-radius: 14px;
        }

        .public-resume-page #public-resume-print-root .resume-brand-footer {
          left: 12px;
          right: 12px;
          font-size: 7px;
        }
      }
    `}</style>
  );
}
