export default async function teardown(){
  await fetch('http://127.0.0.1:54330/__test_shutdown',{
    method:'POST',signal:AbortSignal.timeout(3000),
  });
}
