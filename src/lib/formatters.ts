export function capitalizeWords(text: string | undefined | null): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function capitalizeAddress(address: string | undefined | null): string {
  if (!address) return '';

  const lowerAddress = address.toLowerCase();

  const streetAbbreviations: Record<string, string> = {
    ' st ': ' St ',
    ' st.': ' St.',
    ' ave ': ' Ave ',
    ' ave.': ' Ave.',
    ' rd ': ' Rd ',
    ' rd.': ' Rd.',
    ' dr ': ' Dr ',
    ' dr.': ' Dr.',
    ' ln ': ' Ln ',
    ' ln.': ' Ln.',
    ' blvd ': ' Blvd ',
    ' blvd.': ' Blvd.',
    ' ct ': ' Ct ',
    ' ct.': ' Ct.',
    ' pl ': ' Pl ',
    ' pl.': ' Pl.',
    ' way ': ' Way ',
    ' pkwy ': ' Pkwy ',
    ' pkwy.': ' Pkwy.',
    ' cir ': ' Cir ',
    ' cir.': ' Cir.',
  };

  let formatted = capitalizeWords(lowerAddress);

  for (const [key, value] of Object.entries(streetAbbreviations)) {
    const regex = new RegExp(key, 'gi');
    formatted = formatted.replace(regex, value);
  }

  return formatted;
}

export function capitalizeState(state: string | undefined | null): string {
  if (!state) return '';
  return state.toUpperCase();
}

export function formatContactData(data: any): any {
  const formatted = { ...data };

  if (formatted.name) {
    formatted.name = capitalizeWords(formatted.name);
  }

  if (formatted.company) {
    formatted.company = capitalizeWords(formatted.company);
  }

  if (formatted.branch) {
    formatted.branch = capitalizeWords(formatted.branch);
  }

  if (formatted.address) {
    formatted.address = capitalizeAddress(formatted.address);
  }

  if (formatted.preferred_surveyor) {
    formatted.preferred_surveyor = capitalizeWords(formatted.preferred_surveyor);
  }

  if (formatted.preferred_uw) {
    formatted.preferred_uw = capitalizeWords(formatted.preferred_uw);
  }

  if (formatted.preferred_closer) {
    formatted.preferred_closer = capitalizeWords(formatted.preferred_closer);
  }

  return formatted;
}
