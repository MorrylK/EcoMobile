import React from 'react';
import { MobileBlocked } from '@/components/auth/MobileBlocked';
import { PageTitle } from '@/components/ui/PageTitle';

export default function BlockedScreen() {
  return (
    <>
      <PageTitle 
        titleFr="Compte Bloqué"
        titleEn="Account Blocked"
      />
      <MobileBlocked />
    </>
  );
}
