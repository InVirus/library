<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Origin: *');

function sendJson($data, $status = 200)
{
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  sendJson(['success' => true]);
}

try {
  $dbh = new PDO(
    'mysql:host=sql112.infinityfree.com;dbname=if0_42054193_library;charset=utf8mb4',
    'if0_42054193',
    'Uf8KyHZyMC3voW9'
  );
  $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  sendJson(['error' => 'Database connection failed: ' . $e->getMessage()], 500);
}

$JWT_SECRET = 'library_secret_key_2026';

function base64url_encode($data)
{
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data)
{
  return base64_decode(strtr($data, '-_', '+/'));
}

function createJwt($payload, $secret)
{
  $header = ['alg' => 'HS256', 'typ' => 'JWT'];

  $headerEncoded = base64url_encode(json_encode($header));
  $payloadEncoded = base64url_encode(json_encode($payload));

  $signature = hash_hmac(
    'sha256',
    "$headerEncoded.$payloadEncoded",
    $secret,
    true
  );

  return "$headerEncoded.$payloadEncoded." . base64url_encode($signature);
}

function verifyJwt($token, $secret)
{
  $parts = explode('.', $token);

  if (count($parts) !== 3) {
    return null;
  }

  [$header, $payload, $signature] = $parts;

  $validSignature = base64url_encode(
    hash_hmac('sha256', "$header.$payload", $secret, true)
  );

  if (!hash_equals($validSignature, $signature)) {
    return null;
  }

  $data = json_decode(base64url_decode($payload), true);

  if (!$data) {
    return null;
  }

  if (isset($data['exp']) && time() > $data['exp']) {
    return null;
  }

  return $data;
}

function getBearerToken()
{
  $authHeader = null;

  if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
  } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  } elseif (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();

    if (isset($headers['Authorization'])) {
      $authHeader = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
      $authHeader = $headers['authorization'];
    }
  }

  if (!$authHeader) {
    return null;
  }

  if (preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
    return $matches[1];
  }

  return null;
}

$models = [
  'clients' => [
    'pk' => 'ClientID',
    'fields' => ['FullName', 'Phone', 'Email', 'Address']
  ],
  'books' => [
    'pk' => 'BookID',
    'fields' => ['Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity']
  ],
  'accounting' => [
    'pk' => 'AccountingID',
    'fields' => ['ClientID', 'BookID', 'BorrowDate', 'ReturnDate', 'Status']
  ],
  'users' => [
    'pk' => 'id',
    'fields' => ['username', 'password', 'role', 'ClientID']
  ]
];

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function requireAdmin($role)
{
  if ($role !== 'admin') {
    sendJson(['error' => 'Доступ дозволено тільки адміністратору'], 403);
  }
}

function selectSql($resource)
{
  switch ($resource) {
    case 'accounting':
      return "
        SELECT 
          a.AccountingID,
          a.ClientID,
          a.BookID,
          c.FullName AS ClientName,
          b.Title AS BookTitle,
          b.Author AS BookAuthor,
          a.BorrowDate,
          a.ReturnDate,
          a.Status
        FROM accounting a
        LEFT JOIN clients c ON a.ClientID = c.ClientID
        LEFT JOIN books b ON a.BookID = b.BookID
        WHERE 1=1
      ";

    default:
      return "SELECT * FROM {$resource} WHERE 1=1";
  }
}

function sortFields($resource)
{
  $common = [
    'clients' => ['ClientID', 'FullName', 'Phone', 'Email', 'Address'],
    'books' => ['BookID', 'Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity'],
    'accounting' => ['AccountingID', 'ClientName', 'BookTitle', 'BorrowDate', 'ReturnDate', 'Status'],
    'users' => ['id', 'username', 'role', 'ClientID']
  ];

  return $common[$resource] ?? [];
}

if ($action === 'login') {
  $data = json_decode(file_get_contents('php://input'), true);

  $username = $data['username'] ?? '';
  $password = $data['password'] ?? '';

  $stmt = $dbh->prepare("
    SELECT 
      u.id,
      u.username,
      u.password,
      u.role,
      u.ClientID,
      c.FullName AS ClientName
    FROM users u
    LEFT JOIN clients c ON u.ClientID = c.ClientID
    WHERE u.username = :username
  ");

  $stmt->execute([':username' => $username]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    sendJson([
      'success' => false,
      'error' => 'Користувача не знайдено'
    ], 200);
  }

  if (!password_verify($password, $user['password'])) {
    sendJson([
      'success' => false,
      'error' => 'Невірний пароль'
    ], 200);
  }

  $token = createJwt([
    'id' => $user['id'],
    'username' => $user['username'],
    'role' => $user['role'],
    'clientId' => $user['ClientID'],
    'clientName' => $user['ClientName'],
    'exp' => time() + 60 * 60 * 24
  ], $JWT_SECRET);

  sendJson([
    'success' => true,
    'token' => $token,
    'user' => [
      'id' => $user['id'],
      'username' => $user['username'],
      'role' => $user['role'],
      'clientId' => $user['ClientID'],
      'clientName' => $user['ClientName']
    ]
  ]);
}

if ($action === 'register') {
  $data = json_decode(file_get_contents('php://input'), true);

  $username = trim($data['username'] ?? '');
  $password = trim($data['password'] ?? '');
  $fullName = trim($data['fullName'] ?? '');

  if ($username === '' || $password === '' || $fullName === '') {
    sendJson(['error' => 'Введіть логін, пароль та ПІБ'], 400);
  }

  $stmt = $dbh->prepare("
    SELECT ClientID, FullName
    FROM clients
    WHERE LOWER(FullName) = LOWER(:FullName)
    LIMIT 1
  ");
  $stmt->execute([':FullName' => $fullName]);
  $client = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$client) {
    // Якщо клієнта немає, створюємо його автоматично
    $stmt = $dbh->prepare("INSERT INTO clients (FullName) VALUES (:FullName)");
    $stmt->execute([':FullName' => $fullName]);
    $clientId = $dbh->lastInsertId();
  } else {
    $clientId = $client['ClientID'];
  }

  $stmt = $dbh->prepare("
    SELECT id
    FROM users
    WHERE ClientID = :ClientID
    LIMIT 1
  ");
  $stmt->execute([':ClientID' => $clientId]);
  $existingClientAccount = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existingClientAccount) {
    sendJson(['error' => 'Акаунт для цього клієнта вже існує'], 400);
  }

  $stmt = $dbh->prepare("
    SELECT id
    FROM users
    WHERE username = :username
    LIMIT 1
  ");
  $stmt->execute([':username' => $username]);
  $existingUsername = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($existingUsername) {
    sendJson(['error' => 'Цей логін вже зайнятий'], 400);
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);

  $stmt = $dbh->prepare("
    INSERT INTO users (username, password, role, ClientID)
    VALUES (:username, :password, 'client', :ClientID)
  ");

  $stmt->execute([
    ':username' => $username,
    ':password' => $hash,
    ':ClientID' => $clientId
  ]);

  sendJson(['success' => true]);
}

$resource = $_GET['resource'] ?? '';
$id = $_GET['id'] ?? null;
$token = $_GET['token'] ?? getBearerToken();
$authUser = $token ? verifyJwt($token, $JWT_SECRET) : null;

$role = $authUser['role'] ?? 'guest';
$clientId = $authUser['clientId'] ?? null;

if ($action === 'borrow') {
  if (!$authUser || $authUser['role'] !== 'client') sendJson(['error' => 'Тільки клієнти можуть брати книги'], 403);
  
  $data = json_decode(file_get_contents('php://input'), true);
  $bookId = $data['bookId'] ?? null;
  if (!$bookId) sendJson(['error' => 'Не вказано книгу'], 400);

  $stmt = $dbh->prepare("UPDATE books SET Quantity = Quantity - 1 WHERE BookID = :bookId AND Quantity > 0");
  $stmt->execute([':bookId' => $bookId]);
  
  if ($stmt->rowCount() === 0) {
    sendJson(['error' => 'Книги немає в наявності'], 400);
  }

  $borrowDate = date('Y-m-d');
  $returnDate = date('Y-m-d', strtotime('+14 days')); 

  $stmt = $dbh->prepare("INSERT INTO accounting (ClientID, BookID, BorrowDate, ReturnDate, Status) VALUES (:clientId, :bookId, :bDate, :rDate, 'видано')");
  $stmt->execute([
    ':clientId' => $authUser['clientId'], 
    ':bookId' => $bookId, 
    ':bDate' => $borrowDate, 
    ':rDate' => $returnDate
  ]);

  sendJson(['success' => true]);
}

if ($action === 'return') {
  if (!$authUser || $authUser['role'] !== 'client') sendJson(['error' => 'Тільки клієнти можуть здавати книги'], 403);
  
  $data = json_decode(file_get_contents('php://input'), true);
  $accId = $data['accountingId'] ?? null;

  $stmt = $dbh->prepare("SELECT BookID FROM accounting WHERE AccountingID = :accId AND ClientID = :clientId AND Status IN ('видано', 'протерміновано')");
  $stmt->execute([':accId' => $accId, ':clientId' => $authUser['clientId']]);
  $acc = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$acc) {
      sendJson(['error' => 'Книгу вже повернуто або запис не знайдено'], 400);
  }
  
  $stmt = $dbh->prepare("UPDATE accounting SET Status = 'повернено', ReturnDate = :rDate WHERE AccountingID = :accId AND ClientID = :clientId");
  $stmt->execute([
    ':rDate' => date('Y-m-d'), 
    ':accId' => $accId, 
    ':clientId' => $authUser['clientId']
  ]);

  $stmt = $dbh->prepare("UPDATE books SET Quantity = Quantity + 1 WHERE BookID = :bookId");
  $stmt->execute([':bookId' => $acc['BookID']]);
  
  sendJson(['success' => true]);
}

if (!isset($models[$resource])) {
  sendJson(['error' => 'Невідомий ресурс'], 404);
}

$model = $models[$resource];
$pk = $model['pk'];
$fields = $model['fields'];

switch ($method) {
  case 'GET':
    $sql = selectSql($resource);
    $params = [];

    if ($role === 'guest') {
      $guestAllowed = ['books'];

      if (!in_array($resource, $guestAllowed)) {
        sendJson(['error' => 'Доступ заборонено'], 403);
      }
    }

    if ($role === 'client') {
      $clientAllowed = ['books', 'accounting', 'clients'];

      if (!in_array($resource, $clientAllowed)) {
        sendJson(['error' => 'Доступ заборонено'], 403);
      }

      if ($resource === 'accounting') {
        if (!$clientId) {
          sendJson(['error' => 'Потрібен ID клієнта'], 403);
        }

        $sql .= " AND a.ClientID = :clientID";
        $params[':clientID'] = $clientId;
      }
    }

    if (!$id && !empty($_GET['search'])) {
      $search = '%' . $_GET['search'] . '%';

      if ($resource === 'accounting') {
        $sql .= " AND (
          c.FullName LIKE :search
          OR b.Title LIKE :search
          OR b.Author LIKE :search
          OR a.Status LIKE :search
        )";
      } else {
        $parts = [];

        foreach ($fields as $field) {
          $parts[] = "{$field} LIKE :search";
        }

        if (!empty($parts)) {
          $sql .= " AND (" . implode(' OR ', $parts) . ")";
        }
      }

      $params[':search'] = $search;
    }

    if (!$id && !empty($_GET['sort'])) {
      $sort = $_GET['sort'];
      $direction = strtoupper($_GET['direction'] ?? 'ASC');

      if ($direction !== 'ASC' && $direction !== 'DESC') {
        $direction = 'ASC';
      }

      if (in_array($sort, sortFields($resource))) {
        $sql .= " ORDER BY {$sort} {$direction}";
      }
    }

    if ($id) {
      $sql = "SELECT * FROM {$resource} WHERE {$pk} = :id";
      $params = [':id' => $id];
    }

    try {
      $stmt = $dbh->prepare($sql);
      $stmt->execute($params);
      sendJson($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
      sendJson([
        'error' => 'SQL помилка',
        'message' => $e->getMessage(),
        'sql' => $sql
      ], 500);
    }
    break;

  case 'POST':
    if ($role !== 'admin') {
      sendJson(['error' => 'Доступ заборонено'], 403);
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
      sendJson(['error' => 'Невалідний JSON'], 400);
    }

    if ($resource === 'users' && !empty($data['password'])) {
      $data['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    $insertFields = [];
    $placeholders = [];
    $params = [];

    foreach ($fields as $field) {
      if (isset($data[$field]) && $data[$field] !== '') {
        $insertFields[] = $field;
        $placeholders[] = ':' . $field;
        $params[':' . $field] = $data[$field];
      }
    }

    if (empty($insertFields)) {
      sendJson(['error' => 'Немає валідних полів'], 400);
    }

    $sql = "INSERT INTO {$resource} (" . implode(',', $insertFields) . ") 
            VALUES (" . implode(',', $placeholders) . ")";

    $stmt = $dbh->prepare($sql);
    $stmt->execute($params);

    sendJson(['success' => true, 'id' => $dbh->lastInsertId()], 201);
    break;

  case 'PUT':
    requireAdmin($role);

    if (!$id) {
      sendJson(['error' => 'Потрібен ID'], 400);
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
      sendJson(['error' => 'Невалідний JSON'], 400);
    }

    if ($resource === 'users' && isset($data['password']) && $data['password'] !== '') {
      $data['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    if ($resource === 'users' && isset($data['password']) && $data['password'] === '') {
      unset($data['password']);
    }

    $set = [];
    $params = [];

    foreach ($fields as $field) {
      if (isset($data[$field])) {
        $set[] = "{$field} = :{$field}";
        $params[':' . $field] = $data[$field];
      }
    }

    if (empty($set)) {
      sendJson(['error' => 'Немає валідних полів'], 400);
    }

    $params[':id'] = $id;

    $sql = "UPDATE {$resource} SET " . implode(',', $set) . " WHERE {$pk} = :id";

    $stmt = $dbh->prepare($sql);
    $stmt->execute($params);

    sendJson(['success' => true]);
    break;

  case 'DELETE':
    requireAdmin($role);

    if (!$id) {
      sendJson(['error' => 'Потрібен ID'], 400);
    }

    $stmt = $dbh->prepare("DELETE FROM {$resource} WHERE {$pk} = :id");
    $stmt->execute([':id' => $id]);

    sendJson(['success' => true]);
    break;

  default:
    sendJson(['error' => 'Метод не дозволений'], 405);
}
?>
